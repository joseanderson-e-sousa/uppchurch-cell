"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-xl font-semibold">Não foi possível carregar os dados</h1><p role="alert">Verifique sua conexão e tente novamente. Se o problema persistir, procure o responsável.</p><button className="button" onClick={reset}>Tentar novamente</button><a className="block underline" href="/login">Voltar ao acesso</a></main>;
}
