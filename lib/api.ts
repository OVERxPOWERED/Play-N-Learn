import { RivalsData } from "@/types/rivals";

const apiDataUrl = "";

async function apiFetch<T>(endpoint:string):Promise<T> {
    const response = await fetch(`${apiDataUrl}${endpoint}`,{
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json",
        },
    });
    if (!response.ok){
        return Promise.reject(new Error(`API request failed with status ${response.status}`));
    }
    return response.json() as Promise<T>;
}


export const RivalService = {
    getRivalsData: () : Promise<RivalsData> => apiFetch<RivalsData>("/rivals"),
}