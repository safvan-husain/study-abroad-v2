'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '@study-abroad/contracts';
import { apiClient, type TurnStatus } from '../lib/api-client';
import { pollingCoordinator } from '../lib/coordinator-client';

function clientCommandId() {
 const webCrypto = globalThis.crypto;
 if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();
 const random = webCrypto?.getRandomValues
  ? webCrypto.getRandomValues(new Uint32Array(2))
  : new Uint32Array([Math.floor(Math.random() * 2 ** 32), Math.floor(Math.random() * 2 ** 32)]);
 return `command-${Date.now().toString(36)}-${random[0].toString(36)}${random[1].toString(36)}`;
}

export function useChatConversation(conversationId: string, userId: string = conversationId) { const [messages,setMessages]=useState<ChatMessage[]>([]), [status,setStatus]=useState<TurnStatus>(), [loading,setLoading]=useState(true), [error,setError]=useState<string>();
 const reload=useCallback(async()=>{setLoading(true); try { setMessages(await apiClient(userId).history(conversationId)); setError(undefined); } catch(e) {setError(e instanceof Error?e.message:'Could not load conversation')} finally {setLoading(false)}},[conversationId,userId]); useEffect(()=>{void reload()},[reload]);
 const send=async(content:string)=>{setError(undefined); try { const result=await apiClient(userId).send(conversationId,content,clientCommandId()); setMessages(m=>[...m,result.message]); setStatus(result.status); return pollingCoordinator.subscribe(conversationId,result.status.turnId,s=>{setStatus(s);if(s.status==='completed')void reload();}); } catch(e){setError(e instanceof Error?e.message:'Could not send message')} }; return {messages,status,loading,error,send,reload}; }
