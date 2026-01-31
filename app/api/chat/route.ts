import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import moduleInfo from "@/module_info.json";
import topicRelations from "@/module_topic_relations.json";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Build comprehensive context about Maynooth CS
function buildSystemContext(): string {
  // Format module information
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

  // Format topic relations (what topics in one module lead to other modules)
  const topicContext = Object.entries(topicRelations)
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
${topicContext}

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

export async function POST(request: NextRequest) {
  try {
    const { query, sessionId: clientSessionId } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Get or create session
    const sessionId = clientSessionId || crypto.randomUUID();
    let history = sessions.get(sessionId) || [];

    // Initialize model with system instruction
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemContext(),
    });

    // Start chat with history
    const chat = model.startChat({
      history: history,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    // Send message and get response
    const result = await chat.sendMessage(query);
    const response = result.response;
    const answer = response.text();

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

    // Handle specific Gemini API errors
    if (errorMessage.includes("API key")) {
      return NextResponse.json(
        { error: "Invalid API key configuration" },
        { status: 500 }
      );
    }

    if (errorMessage.includes("quota") || errorMessage.includes("rate")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate response. Please try again." },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint for health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "CSPrime Chat API is running",
  });
}
