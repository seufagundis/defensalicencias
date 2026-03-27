import dotenv from "dotenv";
import { Redis } from "@upstash/redis";

dotenv.config();

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  throw new Error("Faltan UPSTASH_REDIS_REST_URL o UPSTASH_REDIS_REST_TOKEN en el entorno.");
}

export const redis = new Redis({
  url,
  token,
});