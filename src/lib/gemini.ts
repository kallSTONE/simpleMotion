import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const getGeminiModel = () => ai.models.generateContent;

export interface TaskPlanningParams {
  goals: { title: string; description?: string }[];
  userTasks: string[];
  timeRange: string;
}

export async function generateTaskPlan(params: TaskPlanningParams) {
  const prompt = `
    You are a professional productivity coach for an app called "Mero".
    Your goal is to optimize a user's task list based on their personal goals for a given time range.
    
    User Goals:
    ${params.goals.map(g => `- ${g.title}: ${g.description || ''}`).join('\n')}
    
    User Provided Tasks (raw text):
    ${params.userTasks.join('\n')}
    
    Time Range: ${params.timeRange}
    
    Instructions:
    1. Organize the tasks logically for the ${params.timeRange}.
    2. Prioritize tasks that align with the user's goals.
    3. Add 2-4 additional helpful sub-tasks or new tasks that would help achieve their goals.
    4. Categorize tasks by priority (low, medium, high).
    5. Identify which goal each task aligns with (if any).
    6. Distinguish between user-provided tasks and AI-added tasks.
    
    Return the result as a JSON array of tasks with the following structure:
    {
      "tasks": [
        {
          "content": "string",
          "priority": "low" | "medium" | "high",
          "isAiGenerated": boolean,
          "goalAlignment": "Goal Title" | null
        }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return data.tasks || [];
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return [];
  }
}
