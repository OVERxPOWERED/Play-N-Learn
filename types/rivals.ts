export interface RivalsData {
    userName: string;
    userId: string;
    rivalName: string;
    rivalId:string;
    userScore:number;
    rivalScore:number;
    Status: "user" | "rival" | "tie";
    daysLeft:number;
}