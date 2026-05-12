// @ts-nocheck
import { SUPA_URL, SUPA_KEY } from '../core/config';

// Inicializa o cliente do Supabase
export const supabase = window.supabase.createClient(SUPA_URL, SUPA_KEY);
window.supabaseClient = supabase; // expõe globalmente para uso rápido

export async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    document.getElementById('loading-screen')!.style.display = 'none';
    document.getElementById('desktop-layout')!.style.display = 'none';
    document.getElementById('mobile-layout')!.style.display = 'none';
    document.getElementById('auth-modal')!.style.display = 'flex';
  } else {
    document.getElementById('auth-modal')!.style.display = 'none';
  }
  return session;
}

export async function handleLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Erro no login: ' + error.message);
    return;
  }
  await checkAuth(); 
  if (window.initApp) window.initApp(); // Inicia o app agora que tem sessão
}

export async function handleRegister(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName, // Isso vai ser lido pelo nosso Trigger no Banco de Dados!
      }
    }
  });
  
  if (error) {
    console.error("Supabase SignUp Error:", error);
    alert('Erro ao registrar: ' + (error.message || JSON.stringify(error)));
    return;
  }
  alert('Conta criada com sucesso! Faça login.');
}

export async function handleLogout() {
  await supabase.auth.signOut();
  window.location.reload();
}

if (typeof window !== 'undefined') {
  Object.assign(window, { handleLogin, handleRegister, handleLogout, checkAuth });
}
