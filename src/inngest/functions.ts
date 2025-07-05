import { createNetwork, createTool, gemini } from "@inngest/agent-kit";
import { inngest } from "./client";
import { createAgent } from "@inngest/agent-kit"
import { getSandbox, lastAssistantMessageContent } from "./utils";
import Sandbox from "@e2b/code-interpreter";
import z from "zod";
import { PROMPT } from "@/prompt";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event ,step}) => {
    const sandboxId = await step.run("get-sandbox",async ()=>{
    const sandbox = await Sandbox.create('tespsets2');
      return sandbox.sandboxId;
    })
    
    
    const codeAgent = createAgent({
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
  handler: async ({ files }, { network }) => {
    try {
      const updatedFiles = network.state.data.files || {};
      const sandbox = await getSandbox(sandboxId);
      for (const file of files) {
        await sandbox.files.write(file.path, file.content);
        updatedFiles[file.path] = file.content;
      }
      network.state.data.files = updatedFiles;
      return { files: updatedFiles };
    } catch (e) {
      console.error(`Error in createOrUpdateFiles: ${e}`);
      return { error: String(e) };
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
  handler: async ({ files }) => {
    try {
      const sandbox = await getSandbox(sandboxId);
      const contents = [];
      for (const file of files) {
        const content = await sandbox.files.read(file);
        contents.push({ path: file, content });
      }
      return { files: contents };
    } catch (e) {
      console.error(`Error in readFiles: ${e}`);
      return { error: String(e) };
    }
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

    const network = createNetwork({
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

    const sandboxUrl = await step.run("get-sandbox-url",async ()=>{
      const sandbox = await getSandbox(sandboxId)
      const host = sandbox.getHost(3000);
      return `https://${host}`
    })

    return { 
     url: sandboxUrl,
     title: "Fragment",
     files: result.state.data.files,
     summary: result.state.data.summary
    };
  },
);
