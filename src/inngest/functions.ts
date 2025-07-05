import { createNetwork, createTool, gemini, type Tool } from "@inngest/agent-kit";
import { inngest } from "./client";
import { createAgent } from "@inngest/agent-kit"
import { getSandbox, lastAssistantMessageContent } from "./utils";
import Sandbox from "@e2b/code-interpreter";
import z from "zod";
import { PROMPT } from "@/prompt";
import { prisma } from "@/lib/db";


interface AgentState {
  summary:string;
  files: { [path:string]: string};
}


export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event ,step}) => {
    const sandboxId = await step.run("get-sandbox",async ()=>{
    const sandbox = await Sandbox.create('tespsets2');
      return sandbox.sandboxId;
    })
    
    
    const codeAgent = createAgent<AgentState>({
      name:"code-agent",
      system: PROMPT,
      model: gemini({
        model : "gemini-2.0-flash",
         defaultParameters: {
          generationConfig:{
            temperature:0.1,
          }
        },
        apiKey: process.env.GEMINI_API_KEY
        }),
      tools:[
       // Fixed createOrUpdateFiles tool
createTool({
  name: "createOrUpdateFiles",
  description: "Create or update files in sandbox",
  parameters: z.object({
    files: z.array(
      z.object({
        path: z.string(),
        content: z.string(),
      })
    ),
  }),
  handler: async ({ files }, { step, network }:Tool.Options<AgentState>) => {
    const newFiles = await step?.run("createOrUpdateFiles",async ()=>{
    try {
      const updatedFiles = network.state.data.files || {};
      const sandbox = await getSandbox(sandboxId);
      for (const file of files) {
        await sandbox.files.write(file.path, file.content);
        updatedFiles[file.path] = file.content;
      }
      
      return updatedFiles;
    } catch (e) {
      console.error(`Error in createOrUpdateFiles: ${e}`);
      return { error: String(e) };
    }
    
    })
    if(typeof newFiles === "object") {
      network.state.data.files = newFiles;
    }
  },
}),

// Fixed readFiles tool
createTool({
  name: "readFiles",
  description: "Read files from sandbox",
  parameters: z.object({
    files: z.array(z.string()),
  }),
  handler: async ({ files },{step}) => {
    return await step?.run("readFiles", async() =>{

    
    try {
      const sandbox = await getSandbox(sandboxId);
      const contents = [];
      for (const file of files) {
        const content = await sandbox.files.read(file);
        contents.push({ path: file, content });
      }
      return JSON.stringify(contents);
    } catch (e) {
      console.error(`Error in readFiles: ${e}`);
      return "Error" + e;
    }
    })
  },
}),

// Fixed terminal tool (minor improvements)
createTool({
  name: "terminal",
  description: "Use the terminal to run commands",
  parameters: z.object({
    command: z.string(),
  }),
  handler: async ({ command }) => {
    const buffers = { stdout: "", stderr: "" };
    try {
      const sandbox = await getSandbox(sandboxId);
      const result = await sandbox.commands.run(command, {
        onStdout: (data: string) => {
          buffers.stdout += data;
        },
        onStderr: (data: string) => {
          buffers.stderr += data;
        },
      });
      return {
        result,
        stdout: buffers.stdout,
        stderr: buffers.stderr,
      };
    } catch (e) {
      console.error(`Command Failed: ${e}\nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`);
      return {
        error: String(e),
        stdout: buffers.stdout,
        stderr: buffers.stderr,
      };
    }
  },
})
      ],
      lifecycle:{
        onResponse:async ({result , network})=>{
          const lastAssistantMessageText = lastAssistantMessageContent(result)

          if(lastAssistantMessageText && network){
            if(lastAssistantMessageText.includes("<task_summary>")){
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        }
      }
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      router: async ( { network })=>{
        const summary = network.state.data.summary;

        if(summary){
          return;
        }
        return codeAgent;
      }
    })

    const result = await network.run(event.data.value)
    const isError = !result.state.data.summary || Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url",async ()=>{
      const sandbox = await getSandbox(sandboxId)
      const host = sandbox.getHost(3000);
      return `https://${host}`
    })

    await step.run("save-result", async ()=>{
      if (isError) {
        return await prisma.message.create({
          data:{
            content: "Something went Wrong. Please try again",
            role:"ASSISTANT",
            type:"ERROR"
          },
        });
      }

      return await prisma.message.create({
        data:{
          content: result.state.data.summary,
          role:"ASSISTANT",
          type:"RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: "Fragment",
              files: result.state.data.files
            }
          }
        }
      })
    });

    return { 
     url: sandboxUrl,
     title: "Fragment",
     files: result.state.data.files,
     summary: result.state.data.summary
    };
  },
);
