import { gemini } from "@inngest/agent-kit";
import { inngest } from "./client";
import { createAgent } from "@inngest/agent-kit"
import { getSanbox } from "./utils";
import Sandbox from "@e2b/code-interpreter";

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
      system:"YOu are an expert nextjs developer who makes great  tastefull UIs",
      model: gemini({ model : "gemini-2.5-flash"})
    });

    const { output } = await codeAgent.run(
      `write the following snippet: ${event.data.value}`
    )
    const sandboxUrl = await step.run("get-sandbox-url",async ()=>{
      const sandbox = await  getSanbox(sandboxId)
      const host = sandbox.getHost(3000);
      return `https://${host}`
    })

    return { output, sandboxUrl };
  },
);
