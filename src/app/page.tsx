"use client"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";


const Page =  ()=>{
  const router = useRouter();
  const [value,setValue] = useState("");
  const trpc = useTRPC();
  const createProject = useMutation(trpc.projects.create.mutationOptions({
    onError: (error)=>{
      toast.error(error.message);
    },
    onSuccess: (data) =>{
      router.push(`/projects/${data.id}`)
    }
  }))

  return (
    <div className="p-4 max-w-7xl mx-auto ">
      <Input value={value} onChange={e => setValue(e.target.value)}/>
      <Button disabled={createProject.isPending} 
      onClick={() => createProject.mutate({ value : value}) }>
       Submit
      </Button>
  </div>
  )};

export default Page;