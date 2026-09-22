import { useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { BarChart3, SendHorizontal, Settings2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const welcomeMessage: ChatMessage = {
  id: 'staff-welcome',
  role: 'assistant',
  content: 'Asistente interno listo. Pregunta por inventario, ventas, recetas o membresías.',
};

export default function StaffChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
      { id: crypto.randomUUID(), role: 'assistant', content: 'Consultando datos internos…' },
    ]);
    setInput('');
    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('Tu sesión de staff ya no está disponible. Vuelve a iniciar sesión.');
      }

      const { data, error } = await supabase.functions.invoke('staff-chatbot', {
        body: { question: trimmed },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (error) throw error;

      const reply = data?.reply ?? 'No pude responder en este momento.';
      setMessages((current) => [
        ...current.slice(0, -1),
        { id: crypto.randomUUID(), role: 'assistant', content: reply },
      ]);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'No se pudo consultar el asistente interno.';
      setMessages((current) => [
        ...current.slice(0, -1),
        { id: crypto.randomUUID(), role: 'assistant', content: fallback },
      ]);
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
          aria-label="Abrir asistente interno"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-3 rounded-full bg-slate-900 px-3 py-3 text-white shadow-[0_14px_30px_rgba(15,23,42,0.35)] transition hover:bg-slate-800"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/20 ring-1 ring-cyan-300/40">
            <Settings2 className="h-6 w-6 text-cyan-300" />
          </span>
          <span className="hidden pr-2 text-sm font-semibold sm:inline">Asistente staff</span>
        </button>
      )}

      {isOpen && (
        <div className="w-[min(92vw,390px)] overflow-hidden rounded-[24px] border border-slate-700 bg-slate-950 text-slate-100 shadow-[0_24px_60px_rgba(15,23,42,0.4)]">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
                <BarChart3 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Operaciones CocinArte</p>
                <p className="text-[11px] text-slate-400">Inventario · ventas · membresías</p>
              </div>
            </div>
            <button type="button" aria-label="Cerrar asistente staff" onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex max-h-[440px] min-h-[300px] flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-950 p-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[87%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${message.role === 'user' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
                    {message.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="m-0 mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
                          li: ({ children }) => <li>{children}</li>,
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    ) : <span className="whitespace-pre-wrap">{message.content}</span>}
                  </div>
                </div>
              ))}
              {loading && <div className="text-sm text-slate-400">Analizando datos internos…</div>}
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="flex items-center gap-2 border-t border-slate-800 bg-slate-900 p-3">
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pregunta sobre operaciones…" className="h-11 flex-1 rounded-full border border-slate-700 bg-slate-950 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" />
              <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar pregunta" className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">
                <SendHorizontal className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
