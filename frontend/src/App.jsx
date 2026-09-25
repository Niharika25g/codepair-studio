import React, { useState, useEffect, useRef } from 'react';
import { Code2, Users, Copy, Check, FileCode, Terminal, Play, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

export default function App() {
  const getInitialRoom = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'default-room';
  };

  const languageTemplates = {
    java: `public class Solution {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    python: `print("Hello, World!")`,
    javascript: `console.log("Hello, World!");`,
    cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`
  };

  const [roomId, setRoomId] = useState(getInitialRoom);
  const [inputRoomId, setInputRoomId] = useState('');
  const [roomError, setRoomError] = useState('');
  const [language, setLanguage] = useState('java');
  const [code, setCode] = useState(languageTemplates.java);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userCount, setUserCount] = useState(1);
  
  const [output, setOutput] = useState('// Click "Run Code" to execute your workspace...');
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);

  const stompClientRef = useRef(null);
  const isRemoteUpdate = useRef(false);

  const fileExtensions = {
    java: 'Solution.java',
    python: 'main.py',
    javascript: 'script.js',
    cpp: 'solution.cpp'
  };

  // 1. Fetch initial room state & setup URL query param
  useEffect(() => {
    fetch(`http://localhost:8081/api/room/${roomId}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Room does not exist.");
        }
        if (data.code) {
          setCode(data.code);
          setRoomError('');
        }
      })
      .catch(err => {
        setRoomError(err.message);
        setOutput(`>>> [ERROR]: ${err.message}`);
      });

    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.replaceState({ roomId }, '', newUrl);
  }, [roomId]);

  // 2. Setup WebSocket & STOMP Real-time Collaboration
  useEffect(() => {
    const socket = new SockJS('http://localhost:8081/ws-code');
    const stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        stompClient.subscribe(`/topic/code/${roomId}`, (message) => {
          const receivedCode = message.body;
          isRemoteUpdate.current = true;
          setCode(receivedCode);
        });
      },
      onDisconnect: () => {
        setConnected(false);
      }
    });

    stompClient.activate();
    stompClientRef.current = stompClient;

    return () => {
      stompClient.deactivate();
    };
  }, [roomId]);

  // Handle local typing and broadcast to WebSocket peers
  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    setCode(newCode);

    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    if (stompClientRef.current && stompClientRef.current.connected) {
      stompClientRef.current.publish({
        destination: `/app/code/${roomId}`,
        body: newCode
      });
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    const boilerplate = languageTemplates[newLang] || '';
    setCode(boilerplate);
    
    // Broadcast language template change to room peers
    if (stompClientRef.current && stompClientRef.current.connected) {
      stompClientRef.current.publish({
        destination: `/app/code/${roomId}`,
        body: boilerplate
      });
    }
  };

  const createNewRoom = async () => {
    try {
      const response = await fetch('http://localhost:8081/api/room/create', { method: 'POST' });
      const data = await response.json();
      if (data.roomId) {
        setRoomId(data.roomId);
        setCode(data.code);
        setRoomError('');
        window.history.pushState({}, '', `?room=${data.roomId}`);
      }
    } catch (err) {
      console.error("Failed to create new room", err);
    }
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (inputRoomId.trim()) {
      setRoomId(inputRoomId.trim().toLowerCase());
      setInputRoomId('');
    }
  };

  const copyShareableLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Executing code on remote cloud sandbox...');
    setTerminalOpen(true);

    try {
      const response = await fetch('http://localhost:8081/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      });
      const data = await response.json();
      setOutput(data.output);
    } catch (err) {
      setOutput('Error: Failed to communicate with backend execution engine.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 2rem', backgroundColor: '#111827', borderBottom: '1px solid #1f2937' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{ backgroundColor: '#0284c7', padding: '0.45rem', borderRadius: '0.5rem', display: 'flex', boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)' }}>
            <Code2 color="#fff" size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, letterSpacing: '-0.025em', color: '#f8fafc' }}>CodePair Studio</h1>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '500' }}>Cloud Collaborative Engine</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1f2937', padding: '0.3rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #374151' }}>
            <FileCode size={15} color="#38bdf8" />
            <select 
              value={language} 
              onChange={handleLanguageChange}
              style={{ background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: '500' }}
            >
              <option value="java" style={{ background: '#1f2937' }}>Java</option>
              <option value="python" style={{ background: '#1f2937' }}>Python</option>
              <option value="javascript" style={{ background: '#1f2937' }}>JavaScript</option>
              <option value="cpp" style={{ background: '#1f2937' }}>C++</option>
            </select>
          </div>

          <button 
            onClick={runCode}
            disabled={isRunning}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#10b981', color: '#fff', fontWeight: '600', padding: '0.45rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
          >
            <Play size={14} fill="#fff" />
            {isRunning ? 'Running...' : 'Run Code'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1f2937', padding: '0.35rem 0.75rem', borderRadius: '9999px', border: '1px solid #374151', fontSize: '0.8rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: connected ? '#10b981' : '#ef4444' }}></span>
            <span style={{ color: '#94a3b8', fontWeight: '500' }}>{connected ? 'Synced' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.25rem 2rem', maxWidth: '1440px', width: '100%', margin: '0 auto', gap: '1rem', boxSizing: 'border-box' }}>
        
        {/* Control Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111827', padding: '0.875rem 1.5rem', borderRadius: '0.5rem', border: '1px solid #1f2937', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.88rem' }}>
              <Users size={17} color="#38bdf8" />
              <span style={{ color: '#94a3b8' }}>Room:</span> 
              <b style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.92rem' }}>{roomId}</b>
              <button onClick={copyShareableLink} title="Copy Shareable Link" style={{ background: '#1f2937', border: '1px solid #374151', cursor: 'pointer', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: '500', marginLeft: '0.25rem' }}>
                {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Share'}
              </button>
            </div>

            <div style={{ height: '18px', width: '1px', backgroundColor: '#374151' }}></div>
            
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Active peers:</span> 
              <span style={{ color: '#f8fafc', fontWeight: '600', backgroundColor: '#1f2937', padding: '0.1rem 0.5rem', borderRadius: '4px', border: '1px solid #374151' }}>{userCount}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              onClick={createNewRoom}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1rem', backgroundColor: '#0284c7', color: '#fff', fontWeight: '600', fontSize: '0.85rem', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
            >
              <Plus size={15} /> New Room
            </button>

            <form onSubmit={handleJoinRoom} style={{ display: 'flex', gap: '0.4rem' }}>
              <input 
                type="text" 
                placeholder="Enter Room ID..." 
                value={inputRoomId} 
                onChange={(e) => setInputRoomId(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #374151', backgroundColor: '#090d16', color: '#fff', fontSize: '0.85rem', outline: 'none', width: '150px' }}
              />
              <button type="submit" style={{ padding: '0.45rem 0.85rem', backgroundColor: '#1f2937', color: '#f8fafc', fontWeight: '500', fontSize: '0.85rem', border: '1px solid #374151', borderRadius: '0.375rem', cursor: 'pointer' }}>
                Join
              </button>
            </form>
          </div>
        </div>

        {roomError && (
          <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #991b1b', color: '#fca5a5', padding: '0.65rem 1rem', borderRadius: '0.375rem', fontSize: '0.85rem', fontWeight: '500' }}>
            ⚠️ <b>Error:</b> {roomError} - Please enter a valid room ID or create a new room.
          </div>
        )}

        {/* Editor Box */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#111827', borderRadius: '0.5rem', border: '1px solid #1f2937', overflow: 'hidden', minHeight: '380px' }}>
          <div style={{ backgroundColor: '#090d16', padding: '0.6rem 1rem', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Terminal size={14} color="#38bdf8" />
              <span style={{ fontWeight: '500' }}>{fileExtensions[language]}</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Cloud Sandbox Secure Container</span>
          </div>

          <div style={{ flex: 1, display: 'flex', backgroundColor: '#090d16', minHeight: '280px' }}>
            <div style={{ width: '48px', backgroundColor: '#0d1322', color: '#4b5563', padding: '1rem 0.5rem', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.9rem', userSelect: 'none', lineHeight: '1.5', borderRight: '1px solid #1f2937' }}>
              {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea
              value={code}
              onChange={handleCodeChange}
              spellCheck={false}
              style={{ flex: 1, width: '100%', backgroundColor: '#090d16', color: '#e2e8f0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.95rem', padding: '1rem', border: 'none', outline: 'none', resize: 'none', lineHeight: '1.5', tabSize: 2 }}
            />
          </div>
        </div>

        {/* Output Terminal Drawer */}
        <div style={{ backgroundColor: '#111827', borderRadius: '0.5rem', border: '1px solid #1f2937', overflow: 'hidden' }}>
          <div 
            onClick={() => setTerminalOpen(!terminalOpen)}
            style={{ backgroundColor: '#090d16', padding: '0.55rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: terminalOpen ? '1px solid #1f2937' : 'none', fontSize: '0.85rem', color: '#94a3b8' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500', color: '#e2e8f0' }}>
              <Terminal size={15} color="#10b981" /> Execution Terminal Output
            </span>
            {terminalOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>
          {terminalOpen && (
            <pre style={{ margin: 0, padding: '1rem', backgroundColor: '#06090f', color: '#4ade80', fontFamily: 'monospace', fontSize: '0.875rem', maxHeight: '140px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {output}
            </pre>
          )}
        </div>

      </main>
    </div>
  );
}