"use client"

import { useTRPC } from "@/trpc/client"
import { useSuspenseQuery } from "@tanstack/react-query";

export const Client = () =>{

    const trpc = useTRPC();
    const { data } = useSuspenseQuery(trpc.messages.queryOptions({text:"trupal"}))

    return <div>
        { JSON.stringify(data)}
    </div>
}