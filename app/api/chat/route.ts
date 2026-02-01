import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import moduleInfo from "@/module_info.json";
import topicRelations from "@/module_topic_relations.json";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Groq: 14,400 requests/day free (vs Gemini ~1,500). Use Groq when key is set.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Full context for Gemini (handles large prompts)
function buildSystemContext(): string {
  const moduleContext = Object.entries(moduleInfo)
    .map(([code, info]) => {
      const moduleData = info as {
        title: string;
        credits: string;
        semester: string;
        department: string;
        overview: string;
        learningOutcomes: string[];
        year: number;
      };
      return `
**${code}: ${moduleData.title}**
- Year: ${moduleData.year}
- Credits: ${moduleData.credits}
- Semester: ${moduleData.semester}
- Department: ${moduleData.department}
- Overview: ${moduleData.overview}
- Learning Outcomes: ${moduleData.learningOutcomes.join("; ")}
`;
    })
    .join("\n");
  return buildSystemPrompt(moduleContext, topicRelations);
}

// Condensed context for Groq (6K TPM limit - must stay under ~5K tokens)
function buildSystemContextCondensed(): string {
  const moduleContext = Object.entries(moduleInfo)
    .map(([code, info]) => {
      const moduleData = info as {
        title: string;
        credits: string;
        semester: string;
        overview: string;
        year: number;
      };
      const shortOverview =
        moduleData.overview.length > 120
          ? moduleData.overview.slice(0, 117) + "..."
          : moduleData.overview;
      return `${code}: ${moduleData.title} (Y${moduleData.year}, ${moduleData.credits}cr, ${moduleData.semester}) - ${shortOverview}`;
    })
    .join("\n");

  const topicContext = Object.entries(topicRelations)
    .map(([moduleCode, topics]) => {
      const topicsData = topics as Record<string, string[]>;
      return (
        moduleCode +
        ": " +
        Object.entries(topicsData)
          .map(([t, mods]) => `${t}→${mods.join(",")}`)
          .join("; ")
      );
    })
    .join("\n");

  return buildSystemPrompt(moduleContext, topicContext);
}

function buildSystemPrompt(
  moduleContext: string,
  topicContext: string | Record<string, Record<string, string[]>>
): string {
  const topics =
    typeof topicContext === "string"
      ? topicContext
      : Object.entries(topicContext)
          .map(([moduleCode, topics]) => {
            const topicsData = topics as Record<string, string[]>;
            const topicsList = Object.entries(topicsData)
              .map(
                ([topic, relatedModules]) =>
                  `  - ${topic} → ${relatedModules.join(", ")}`
              )
              .join("\n");
            return `${moduleCode}:\n${topicsList}`;
          })
          .join("\n\n");

  return `
You are a helpful AI assistant for the CSPrime website, a platform designed for Computer Science students at Maynooth University, Ireland.

## About CSPrime Website
CSPrime is an educational platform that helps students:
- Explore and understand Computer Science modules offered at Maynooth University
- See how topics in one module connect to other modules (topic relationships)
- View analytics about their learning progress
- Access information about the CS degree programme

## About Maynooth University
Maynooth University (Ollscoil Mhá Nuad) is one of Ireland's leading universities, located in Maynooth, County Kildare. The Department of Computer Science offers a comprehensive undergraduate programme covering:
- First Year: Introduction to programming (CS161, CS162), Computer Systems (CS171, CS172), Mathematics (MT101SC, MT102SC, MT113SC)
- Second Year: Data Structures & Algorithms (CS210, CS211), Databases (CS130), Computer Architecture (CS220), Operating Systems (CS240), Software Engineering (CS335), UX/UI Design (CS280), Web Development (CS230), Statistics (ST221)
- Third Year: Computer Networks (CS320), Compilers (CS310), Theory of Computation (CS355), Software Design (CS264), Software Testing (CS265), Software Verification (CS357), Team Project (CS353), and optional Work Placement
- Fourth Year: Machine Learning (CS401), AI & NLP (CS404), Computer Vision (CS410), Computer Graphics (CS426), Cryptography (CS416), Final Year Project (CS440), and many electives

## Maynooth CS Resources
- Department Website: https://www.maynoothuniversity.ie/computer-science
- Course Handbook: https://www.maynoothuniversity.ie/study-maynooth/undergraduate-studies/courses/computer-science
- Moodle (Learning Management System): https://moodle.maynoothuniversity.ie
- Student Services: https://www.maynoothuniversity.ie/student-services

## Module Information
Here is detailed information about all CS and related modules:
${moduleContext}

## Topic Connections
Here's how topics in first-year modules connect to advanced modules:
${topics}

## Your Role
1. Answer questions about Maynooth University CS modules - their content, prerequisites, what you'll learn
2. Help students understand how topics connect across different modules
3. Explain programming concepts (Java, Python, algorithms, data structures, etc.)
4. Provide guidance on course selection and module pathways
5. Answer general questions about the CSPrime website
6. Provide study tips and learning resources for CS topics

## Guidelines
- Be friendly, helpful, and encouraging to students
- When discussing modules, reference the specific module codes (e.g., CS210, CS404)
- For programming questions, provide clear explanations with code examples when helpful
- If asked about something outside your knowledge, be honest about limitations
- Encourage students to also consult official Maynooth resources for the most up-to-date information
- Keep responses focused and relevant to CS education at Maynooth
`;
}

// In-memory session storage (for production, use Redis or a database)
const sessions = new Map<
  string,
  Array<{ role: string; parts: Array<{ text: string }> }>
>();

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

async function sendWithRetry(
  chat: {
    sendMessage: (msg: string) => Promise<{ response: { text: () => string } }>;
  },
  query: string
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await chat.sendMessage(query);
      return result.response.text();
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        const delay = Math.min(1000 * 2 ** attempt, 5000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

export async function POST(request: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  try {
    const { query, sessionId: clientSessionId } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (!groqKey && !geminiKey) {
      return NextResponse.json(
        { error: "Set GROQ_API_KEY or GEMINI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // Get or create session
    const sessionId = clientSessionId || crypto.randomUUID();
    let history = sessions.get(sessionId) || [];
    const systemContext = buildSystemContext();

    let answer: string | null = null;
    let lastError: unknown;

    // Prefer Groq (14.4K requests/day free vs Gemini ~1.5K)
    // Use condensed context - Groq has 6K TPM limit on llama-3.1-8b
    if (groqKey) {
      try {
        const groqContext = buildSystemContextCondensed();
        // Limit history for Groq - llama-3.1 has 6K TPM, condensed context ~4K, leave ~2K for history
        const groqHistory = history.slice(-6);
        const messages: Array<{
          role: "system" | "user" | "assistant";
          content: string;
        }> = [
          { role: "system", content: groqContext },
          ...groqHistory.map((m) => ({
            role: (m.role === "model" ? "assistant" : "user") as
              | "user"
              | "assistant",
            content: m.parts[0]?.text ?? "",
          })),
          { role: "user", content: query },
        ];

        const res = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            // llama-4-scout: 30K TPM, 1K RPD. Fallback: llama-3.1-8b has 6K TPM (condensed context fits)
            model: "llama-3.1-8b-instant",
            messages,
            max_tokens: 8192,
            temperature: 0.7,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message ?? `Groq ${res.status}`);
        }

        const data = await res.json();
        answer = data.choices?.[0]?.message?.content?.trim() ?? "";
      } catch (err) {
        lastError = err;
        console.error("Groq API failed:", err);
      }
    }

    // Fallback to Gemini only when Groq key is NOT set (avoid rate-limited Gemini when user chose Groq)
    if (!answer && geminiKey && !groqKey) {
      for (const modelId of MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelId,
            systemInstruction: systemContext,
          });

          const chat = model.startChat({
            history: history,
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.7,
            },
          });

          answer = await sendWithRetry(chat, query);
          break;
        } catch (err) {
          lastError = err;
          continue;
        }
      }
    }

    if (!answer) {
      throw lastError;
    }
    // Update history for this session
    history.push(
      { role: "user", parts: [{ text: query }] },
      { role: "model", parts: [{ text: answer }] }
    );

    // Keep only last 20 messages to prevent context overflow
    if (history.length > 20) {
      history = history.slice(-20);
    }
    sessions.set(sessionId, history);

    return NextResponse.json({
      answer,
      session_id: sessionId,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorCause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";

    // Handle specific Gemini API errors
    if (errorMessage.includes("API key")) {
      return NextResponse.json(
        { error: "Invalid API key configuration" },
        { status: 500 }
      );
    }

    const isCertError =
      errorMessage.includes("certificate") ||
      errorMessage.includes("UNABLE_TO_VERIFY") ||
      errorCause.includes("certificate") ||
      errorCause.includes("UNABLE_TO_VERIFY");

    if (
      !isCertError &&
      (errorMessage.includes("quota") ||
        errorMessage.includes("rate") ||
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("429"))
    ) {
      return NextResponse.json(
        {
          error:
            "Rate limit or temporary error. Please wait a moment and try again.",
        },
        { status: 429 }
      );
    }

    // When Groq was used, surface the actual error
    let userMessage = "Failed to generate response. Please try again.";
    if (groqKey && errorMessage) {
      if (isCertError) {
        userMessage =
          "TLS certificate error (common on Windows with antivirus/VPN). Add NODE_TLS_REJECT_UNAUTHORIZED=0 to .env.local and restart. Dev only.";
      } else {
        userMessage = `Groq error: ${errorMessage}. Check your API key at console.groq.com`;
      }
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}

// Optional: GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "CSPrime Chat API is running",
  });
}
