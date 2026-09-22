import { useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, MessageCircleMore, SendHorizontal, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hola 👋 Soy el asistente de COCINARTE HOUSE. Puedes preguntarme por el menú, precios, horarios, ubicación o el estado de la cafetería.',
};

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };

    const assistantPlaceholder: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Estoy revisando la información actual de la cafetería...',
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chatbot', {
        body: { question: trimmed },
      });

      if (error) {
        throw error;
      }

      const reply = data?.reply ?? 'No pude responder en este momento, inténtalo de nuevo.';

      setMessages((prev) => {
        const withoutPlaceholder = prev.slice(0, -1);
        return [...withoutPlaceholder, { id: crypto.randomUUID(), role: 'assistant', content: reply }];
      });
    } catch (error) {
      const fallback =
        error instanceof Error
          ? error.message
          : 'Hubo un error al consultar la información. Inténtalo más tarde.';

      setMessages((prev) => {
        const withoutPlaceholder = prev.slice(0, -1);
        return [...withoutPlaceholder, { id: crypto.randomUUID(), role: 'assistant', content: fallback }];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendQuestion(input);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!isOpen && (
        <button
          type="button"
          aria-label="Abrir chat de la cafetería"
          onClick={() => setIsOpen(true)}
          className="group flex h-12 w-12 items-center justify-center rounded-full border border-[#d4a017]/80 bg-[#3b2a1a] text-[#f4c542] shadow-[0_12px_30px_rgba(59,42,26,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#4b3521] focus:outline-none focus:ring-2 focus:ring-[#d4a017] focus:ring-offset-2"
        >
          <MessageCircleMore className="h-5 w-5" />
        </button>
      )}

      {isOpen && (
        <div className="w-[min(92vw,380px)] overflow-hidden rounded-[28px] border border-background-200 bg-background-50 shadow-[0_24px_60px_rgba(45,30,18,0.2)] ring-1 ring-primary-100">
          <div className="flex items-center justify-between bg-primary-700 px-4 py-3 text-background-50">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background-50/10">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">CocinArte Assistant</p>
                <p className="text-[11px] text-background-50/80">Responde en tiempo real</p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Cerrar chat"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-background-50/10 transition hover:bg-background-50/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex max-h-[440px] min-h-[300px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto bg-background-50 p-4">
              {messages.map((message) => {
                const isAssistantMessage = message.role === 'assistant';

                return (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-primary-600 text-background-50'
                          : 'bg-background-100 text-foreground-900'
                      }`}
                    >
                      {isAssistantMessage ? (
                        <div className="chatbot-markdown text-sm leading-relaxed text-inherit">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
                              ul: ({ children }) => <ul className="m-0 mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                              ol: ({ children }) => <ol className="m-0 mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
                              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                              em: ({ children }) => <em className="italic text-inherit">{children}</em>,
                              a: ({ children, href }) => (
                                <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{message.content}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-background-100 px-3 py-2 text-sm text-foreground-700">
                    Pensando...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-background-200 bg-background-100 p-3">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Escribe tu pregunta..."
                className="h-11 flex-1 rounded-full border border-background-300 bg-background-50 px-4 text-sm text-foreground-900 outline-none transition placeholder:text-foreground-500 focus:border-primary-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-500 text-foreground-950 transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Enviar mensaje"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
