'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '@study-abroad/contracts';
import { apiClient, type TurnStatus } from '../lib/api-client';
import { pollingCoordinator } from '../lib/coordinator-client';
export function useChatConversation(conversationId: string) { const [messages,setMessages]=useState<ChatMessage[]>([]), [status,setStatus]=useState<TurnStatus>(), [loading,setLoading]=useState(true), [error,setError]=useState<string>();
 const reload=useCallback(async()=>{setLoading(true); try { setMessages(await apiClient().history(conversationId)); setError(undefined); } catch(e) {setError(e instanceof Error?e.message:'Could not load conversation')} finally {setLoading(false)}},[conversationId]); useEffect(()=>{void reload()},[reload]);
 const send=async(content:string)=>{setError(undefined); try { const result=await apiClient().send(conversationId,content,crypto.randomUUID()); setMessages(m=>[...m,result.message]); setStatus(result.status); return pollingCoordinator.subscribe(conversationId,result.status.turnId,s=>{setStatus(s);if(s.status==='completed')void reload();}); } catch(e){setError(e instanceof Error?e.message:'Could not send message')} }; return {messages,status,loading,error,send,reload}; }
