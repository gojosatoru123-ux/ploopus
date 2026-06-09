'use server'
import { PLANS } from "@/lib/constants";
import Razorpay from "razorpay";
const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export async function createOrder (planName: string, userId: string) {
    const plan = PLANS[planName as keyof typeof PLANS]
    const amount = plan.price
    const options = {
        amount: amount * 100, // amount in the smallest currency unit
        currency: "INR",
        notes: {
            userId: userId,
            planName: planName,
        }
    }
    const order = await razorpay.orders.create(options)
    return order
}