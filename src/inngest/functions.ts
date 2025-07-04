import { gemini } from "@inngest/agent-kit";
import { inngest } from "./client";
import { createAgent } from "@inngest/agent-kit"

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event }) => {
    const codeAgent = createAgent({
      name:"code-agent",
      system:"YOu are an expert nextjs developer who makes great  tastefull UIs",
      model: gemini({ model : "gemini-2.5-flash"})
    });

    const { output } = await codeAgent.run(
      `write the following snippet: ${event.data.value}`
    )
    // await step.sleep("wait-a-moment", "5s");

    return { output };
  },
);
