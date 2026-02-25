import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  MessageSquare, 
  Image as ImageIcon, 
  Code, 
  Settings, 
  Search, 
  MoreVertical, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Send,
  Sparkles,
  Terminal,
  Layers,
  Cpu,
  Zap,
  Github,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Download,
  Play,
  Maximize2,
  ExternalLink,
  Paperclip
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn, generateId } from './lib/utils';
import { Conversation, Message, GeneratedImage } from './types';
import { chatStream, generateImage, analyzeImage } from './services/gemini';
import { useDropzone } from 'react-dropzone';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'images' | 'code' | 'projects'>('chat');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    fetchImages();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    setConversations(data);
  };

  const fetchMessages = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}/messages`);
    const data = await res.json();
    setMessages(data);
  };

  const fetchImages = async () => {
    const res = await fetch('/api/images');
    const data = await res.json();
    setImages(data);
  };

  const createNewConversation = async () => {
    const id = generateId();
    const newConv = {
      id,
      title: 'New Conversation',
      model: 'gemini-3.1-pro',
      created_at: new Date().toISOString()
    };
    await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConv)
    });
    setConversations([newConv, ...conversations]);
    setActiveConversationId(id);
    setActiveTab('chat');
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    let convId = activeConversationId;
    if (!convId) {
      const id = generateId();
      const newConv = {
        id,
        title: input.slice(0, 30) + '...',
        model: 'gemini-3.1-pro',
        created_at: new Date().toISOString()
      };
      await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConv)
      });
      setConversations([newConv, ...conversations]);
      setActiveConversationId(id);
      convId = id;
    }

    const userMsg: Message = {
      id: generateId(),
      conversation_id: convId,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsGenerating(true);

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userMsg)
    });

    try {
      // Check if it's an image generation request
      if (input.toLowerCase().startsWith('/image ') || input.toLowerCase().includes('generate an image')) {
        const prompt = input.replace('/image ', '').trim();
        const imageUrl = await generateImage(prompt);
        const imageId = generateId();
        
        await fetch('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: imageId, prompt, url: imageUrl, model: 'gemini-2.5-flash-image' })
        });
        
        const aiMsg: Message = {
          id: generateId(),
          conversation_id: convId,
          role: 'model',
          content: `Generated image for: "${prompt}"\n\n![Generated Image](${imageUrl})`,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, aiMsg]);
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(aiMsg)
        });
        fetchImages();
      } else {
        // Standard chat stream
        const stream = await chatStream(input);
        let fullContent = '';
        const aiMsgId = generateId();
        
        // Initial placeholder for streaming
        setMessages(prev => [...prev, {
          id: aiMsgId,
          conversation_id: convId!,
          role: 'model',
          content: '',
          timestamp: new Date().toISOString()
        }]);

        for await (const chunk of stream) {
          fullContent += chunk.text || '';
          setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: fullContent } : m));
        }

        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: aiMsgId,
            conversation_id: convId,
            role: 'model',
            content: fullContent,
            timestamp: new Date().toISOString()
          })
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    // Handle file upload for analysis
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const mimeType = file.type;
      
      // For now, let's just add a message about the file
      const userMsg: Message = {
        id: generateId(),
        conversation_id: activeConversationId || 'temp',
        role: 'user',
        content: `Analyzing file: ${file.name}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, userMsg]);
      
      setIsGenerating(true);
      try {
        const analysis = await analyzeImage(`Analyze this file: ${file.name}`, base64, mimeType);
        const aiMsg: Message = {
          id: generateId(),
          conversation_id: activeConversationId || 'temp',
          role: 'model',
          content: analysis || 'Could not analyze file.',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMsg]);
      } catch (e) {
        console.error(e);
      } finally {
        setIsGenerating(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

  const renderCodeBlock = (props: any) => {
    const { children, className, node, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    const code = String(children).replace(/\n$/, '');
    
    return match ? (
      <div className="group relative my-4">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-x border-t border-white/5 rounded-t-xl text-xs text-zinc-400 font-mono">
          <span>{match[1]}</span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigator.clipboard.writeText(code)}
              className="p-1 hover:text-white transition-colors"
            >
              <Copy size={14} />
            </button>
            {(match[1] === 'html' || match[1] === 'javascript' || match[1] === 'typescript') && (
              <button 
                onClick={() => {
                  setPreviewContent(code);
                  setShowPreview(true);
                }}
                className="p-1 hover:text-emerald-400 transition-colors"
              >
                <Play size={14} />
              </button>
            )}
          </div>
        </div>
        <pre className={cn("!mt-0 !rounded-t-none", className)}>
          <code {...rest} className={className}>
            {children}
          </code>
        </pre>
      </div>
    ) : (
      <code {...rest} className={className}>
        {children}
      </code>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0A0A0A]" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="relative flex flex-col h-full glass-dark border-r border-white/5 z-20 overflow-hidden"
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-black">
              <Sparkles size={18} />
            </div>
            <span>OmniAI</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="px-4 mb-4">
          <button 
            onClick={createNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-black rounded-xl font-medium hover:bg-zinc-200 transition-all active:scale-[0.98]"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="px-2 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recent Chats</div>
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group",
                activeConversationId === conv.id ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              <MessageSquare size={16} className="shrink-0" />
              <span className="truncate text-left flex-1">{conv.title}</span>
              <MoreVertical size={14} className="shrink-0 opacity-0 group-hover:opacity-100" />
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-white/5 transition-colors">
            <Settings size={16} />
            <span>Settings</span>
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs">JD</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">John Doe</div>
              <div className="text-[10px] text-zinc-500">Pro Plan</div>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-bottom border-white/5 glass z-10">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                <PanelLeftOpen size={18} />
              </button>
            )}
            <nav className="flex items-center gap-1 p-1 bg-white/5 rounded-xl">
              <button 
                onClick={() => setActiveTab('chat')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-medium transition-all", activeTab === 'chat' ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200")}
              >
                Chat
              </button>
              <button 
                onClick={() => setActiveTab('images')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-medium transition-all", activeTab === 'images' ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200")}
              >
                Gallery
              </button>
              <button 
                onClick={() => setActiveTab('code')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-medium transition-all", activeTab === 'code' ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200")}
              >
                Code
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
              <Zap size={12} />
              <span>Gemini 3.1 Pro</span>
            </div>
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400">
              <Github size={18} />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full flex flex-col"
              >
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-6">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
                        <Sparkles size={32} />
                      </div>
                      <h1 className="text-4xl font-serif font-bold tracking-tight">How can I help you today?</h1>
                      <p className="text-zinc-400">I can help you build complex apps, generate stunning visuals, or analyze large codebases. Try one of the suggestions below.</p>
                      
                      <div className="grid grid-cols-2 gap-3 w-full">
                        {[
                          { icon: <Code size={16} />, title: "Build a React Dashboard", desc: "Using Tailwind and Framer Motion" },
                          { icon: <ImageIcon size={16} />, title: "Generate a Cyberpunk City", desc: "4K resolution, cinematic lighting" },
                          { icon: <Terminal size={16} />, title: "Explain Big O Notation", desc: "With practical code examples" },
                          { icon: <Layers size={16} />, title: "Analyze Project Structure", desc: "Upload your ZIP file to start" }
                        ].map((item, i) => (
                          <button 
                            key={i}
                            onClick={() => setInput(item.title)}
                            className="p-4 text-left glass hover:bg-white/10 rounded-2xl transition-all group"
                          >
                            <div className="text-emerald-400 mb-2 group-hover:scale-110 transition-transform">{item.icon}</div>
                            <div className="text-sm font-medium mb-1">{item.title}</div>
                            <div className="text-[10px] text-zinc-500">{item.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={cn(
                          "flex gap-4 max-w-4xl mx-auto",
                          msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold",
                          msg.role === 'user' ? "bg-zinc-800 text-zinc-400" : "bg-emerald-500 text-black"
                        )}>
                          {msg.role === 'user' ? 'U' : <Sparkles size={14} />}
                        </div>
                        <div className={cn(
                          "flex-1 min-w-0 space-y-2",
                          msg.role === 'user' ? "text-right" : "text-left"
                        )}>
                          <div className={cn(
                            "inline-block rounded-2xl px-4 py-3 text-sm",
                            msg.role === 'user' ? "bg-white/5 text-zinc-200" : "bg-transparent text-zinc-300"
                          )}>
                            <div className="markdown-body">
                              <ReactMarkdown components={{ code: renderCodeBlock }}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="text-[10px] text-zinc-600 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 max-w-4xl mx-auto w-full">
                  <div className={cn(
                    "relative glass rounded-2xl p-2 transition-all focus-within:ring-1 focus-within:ring-emerald-500/50",
                    isDragActive && "bg-emerald-500/10 border-emerald-500"
                  )}>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask anything... (Type /image for visuals)"
                      className="w-full bg-transparent border-none focus:ring-0 text-sm py-3 px-4 resize-none min-h-[60px] max-h-[200px]"
                      rows={1}
                    />
                    <div className="flex items-center justify-between px-2 pb-1">
                      <div className="flex items-center gap-1">
                        <button className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
                          <Paperclip size={18} />
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
                          <ImageIcon size={18} />
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 transition-colors">
                          <Code size={18} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {input.length} chars
                        </div>
                        <button 
                          onClick={handleSendMessage}
                          disabled={!input.trim() || isGenerating}
                          className={cn(
                            "p-2 rounded-xl transition-all",
                            input.trim() && !isGenerating ? "bg-emerald-500 text-black hover:scale-105" : "bg-zinc-800 text-zinc-600"
                          )}
                        >
                          {isGenerating ? (
                            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                          ) : (
                            <Send size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-center text-[10px] text-zinc-600">
                    OmniAI can make mistakes. Verify important information.
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'images' && (
              <motion.div 
                key="images"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-y-auto p-8"
              >
                <div className="max-w-6xl mx-auto space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-serif font-bold">Image Gallery</h2>
                      <p className="text-sm text-zinc-500">Your AI-generated masterpieces</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm transition-colors">
                      <Download size={16} />
                      <span>Export All</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((img) => (
                      <motion.div 
                        key={img.id}
                        layoutId={img.id}
                        className="group relative aspect-square rounded-2xl overflow-hidden glass cursor-pointer"
                      >
                        <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                          <p className="text-xs text-white line-clamp-2 mb-2">{img.prompt}</p>
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
                              <Maximize2 size={14} />
                            </button>
                            <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    {images.length === 0 && (
                      <div className="col-span-full py-20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto text-zinc-600">
                          <ImageIcon size={32} />
                        </div>
                        <p className="text-zinc-500">No images generated yet. Try asking for one in the chat!</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'code' && (
              <motion.div 
                key="code"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col p-8"
              >
                <div className="max-w-6xl mx-auto w-full space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-serif font-bold">Code Workspace</h2>
                      <p className="text-sm text-zinc-500">Manage snippets and project files</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 transition-colors">
                        <Search size={18} />
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black rounded-xl text-sm font-medium transition-colors">
                        <Plus size={16} />
                        <span>New Snippet</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-3 text-emerald-400">
                        <Cpu size={20} />
                        <h3 className="font-medium">Project Mode</h3>
                      </div>
                      <p className="text-sm text-zinc-400">Upload a ZIP file or connect a GitHub repository to analyze the entire codebase with 200k token context.</p>
                      <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all">
                        Connect Repository
                      </button>
                    </div>
                    <div className="glass rounded-2xl p-6 space-y-4">
                      <div className="flex items-center gap-3 text-blue-400">
                        <Layers size={20} />
                        <h3 className="font-medium">Live Preview</h3>
                      </div>
                      <p className="text-sm text-zinc-400">Run HTML, CSS, and JS in a secure sandbox. Support for React, Vue, and Python visualizations.</p>
                      <button className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all">
                        Open Sandbox
                      </button>
                    </div>
                  </div>

                  <div className="glass rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent Snippets</span>
                      <button className="text-xs text-emerald-400 hover:underline">View All</button>
                    </div>
                    <div className="divide-y divide-white/5">
                      {[
                        { name: "AuthMiddleware.ts", lang: "TypeScript", date: "2h ago" },
                        { name: "DataVisualization.py", lang: "Python", date: "5h ago" },
                        { name: "LandingPage.html", lang: "HTML", date: "1d ago" }
                      ].map((item, i) => (
                        <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-500">
                              <Code size={20} />
                            </div>
                            <div>
                              <div className="text-sm font-medium group-hover:text-emerald-400 transition-colors">{item.name}</div>
                              <div className="text-[10px] text-zinc-500">{item.lang} • {item.date}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-400"><Copy size={14} /></button>
                            <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-400"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-6xl h-full glass rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="h-14 px-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-xs font-mono text-zinc-400 ml-4">Live Preview • index.html</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white/10 rounded-lg text-zinc-400"><ExternalLink size={16} /></button>
                  <button 
                    onClick={() => setShowPreview(false)}
                    className="p-2 hover:bg-white/10 rounded-lg text-zinc-400"
                  >
                    <Plus size={20} className="rotate-45" />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-white">
                <iframe 
                  title="Preview"
                  srcDoc={previewContent || ''}
                  className="w-full h-full border-none"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette Overlay */}
      <div className="fixed bottom-6 right-6 z-30">
        <button className="w-12 h-12 rounded-full bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 flex items-center justify-center hover:scale-110 transition-transform active:scale-95">
          <Command size={20} />
        </button>
      </div>
    </div>
  );
}
