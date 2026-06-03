'use server'
import { db } from "@/db/drizzle";
import { userSubscription } from "@/db/schema";
import crypto from "crypto";
import Razorpay from "razorpay";

const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const generatedSignature = (
  razorpayOrderId: string,
  razorpayPaymentId: string
) => {
  const keySecret = process.env.RAZORPAY_KEY_SECRET as string;

  const sig = crypto
    .createHmac("sha256", keySecret)
    .update(razorpayOrderId + "|" + razorpayPaymentId)
    .digest("hex");
  return sig;
};

export async function verifyOrder({
    orderId, 
    razorpayPaymentId, 
    razorpaySignature
}:{
    orderId:string, 
    razorpayPaymentId:string, 
    razorpaySignature:string
}) {

  const signature = generatedSignature(orderId, razorpayPaymentId);
  if (signature !== razorpaySignature) {
    return { message: "payment verification failed", isOk: false }
  }

  try {
    // Securely fetch the order metadata straight from Razorpay API
    const razorpayOrder = await razorpay.orders.fetch(orderId);
    const userId = (razorpayOrder.notes as any).userId;
    const planName = (razorpayOrder.notes as any).planName;
    const amount = Number(razorpayOrder.amount);

    if (!userId || !planName) {
      return { message: "Invalid order tracking metadata", isOk: false };
    }

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);

    // Upsert row cleanly using Drizzle. Guard against race conditions using onConflictDoUpdate
    await db.insert(userSubscription)
      .values({
        id: crypto.randomUUID(),
        userId,
        razorpayOrderId: orderId,
        razorpayPaymentId,
        planName,
        amount,
        status: "active",
        expiresAt: expirationDate,
      })
      .onConflictDoUpdate({
        target: userSubscription.razorpayOrderId,
        set: {
          razorpayPaymentId,
          status: "active",
          expiresAt: expirationDate,
        }
      });
  
    return { message: "Subscription active!", isOk: true };
  } catch (error) {
    console.error("Order processing error:", error);
    return { message: "Internal server error during fulfillment", isOk: false };
  }  
}