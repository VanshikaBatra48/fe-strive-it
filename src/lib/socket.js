import { io } from "socket.io-client";
import { getApiBaseUrl } from "../api/axios";

// "http://localhost:3000/api" -> "http://localhost:3000"
const SOCKET_URL = getApiBaseUrl().replace(/\/api\/?$/, "");

export const socket = io(SOCKET_URL, {
  autoConnect: false, // connects after login, from NotificationProvider
});