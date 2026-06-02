import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { AuthError } from "@supabase/supabase-js";

const Login = () => {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [loading, setLoading] = useState(false);

  // ═══ INTERCEPTOR DE AUTO-LOGIN (Click en el mail) ═══
  useEffect(() => {
    const handleAutoLogin = async () => {
      const pendingFacility = localStorage.getItem("pendingFacilityName");
      
      if (pendingFacility) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: rpcError } = await supabase.rpc("create_facility_for_user" as any, { p_name: pendingFacility });
          
          if (rpcError) {
            console.error("Error al crear el predio:", rpcError);
            toast({ 
              title: "Error al crear el predio", 
              description: "No se pudo vincular el predio. ¿Ya existe uno con ese nombre?", 
              variant: "destructive" 
            });
            // Si falla, lo deslogueamos para que no quede "fantasma" y frene la redirección
            await supabase.auth.signOut();
            return; 
          } else {
            localStorage.removeItem("pendingFacilityName");
          }
        } catch (e) {
          console.error("Error crítico creando el predio post-confirmación", e);
          return;
        }
      }
      
      navigate("/admin");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) handleAutoLogin();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        handleAutoLogin();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleError = (err: unknown) => {
    if (err instanceof Error || err instanceof AuthError) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } else {
      toast({ title: "Error", description: "Ocurrió un error inesperado.", variant: "destructive" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        if (error.message.includes("Email not confirmed")) {
           toast({ title: "Verificá tu correo", description: "Por favor, confirmá tu cuenta con el link que te enviamos al mail.", variant: "destructive" });
           return;
        }
        throw error;
      }
      
      const pendingFacility = localStorage.getItem("pendingFacilityName");
      if (pendingFacility) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: rpcError } = await supabase.rpc("create_facility_for_user" as any, { p_name: pendingFacility });
        
        if (rpcError) {
           console.error("Error al crear el predio:", rpcError);
           toast({ title: "Error", description: "No se pudo crear el predio.", variant: "destructive" });
           await supabase.auth.signOut();
           return; // Cortamos acá si falla
        } else {
           localStorage.removeItem("pendingFacilityName");
        }
      }

      navigate("/admin");
    } catch (err: unknown) {
      handleError(err);
    } finally { 
      setLoading(false); 
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facilityName.trim()) {
      toast({ title: "Atención", description: "Ingresá el nombre de tu predio", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      localStorage.setItem("pendingFacilityName", facilityName.trim());

      const { data, error } = await supabase.auth.signUp({
        email, 
        password,
        options: { 
          emailRedirectTo: `${window.location.origin}/auth/login` 
        }
      });
      
      if (error) throw error;
      
      if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
           toast({ title: "Error", description: "Este correo ya está registrado.", variant: "destructive" });
           localStorage.removeItem("pendingFacilityName");
        } else if (data.session === null) {
           toast({ title: "¡Registro casi listo!", description: "Te enviamos un link a tu correo para activar la cuenta.", variant: "default" });
           setIsRegister(false);
           setPassword("");
        } else {
           // En caso de que tengas el auto-confirm activado localmente
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           const { error: rpcError } = await supabase.rpc("create_facility_for_user" as any, { p_name: facilityName.trim() });
           
           if (rpcError) {
             console.error("Error al crear predio directo:", rpcError);
             toast({ title: "Error", description: "Ya existe un predio con ese nombre.", variant: "destructive" });
             // Lo deslogueamos para evitar el fantasma
             await supabase.auth.signOut();
             return;
           }
           
           localStorage.removeItem("pendingFacilityName");
           navigate("/admin");
        }
      }
    } catch (err: unknown) {
      handleError(err);
    } finally { 
      setLoading(false); 
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Atención", description: "Ingresá tu correo electrónico", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      toast({ title: "Correo enviado", description: "Revisá tu bandeja de entrada para restablecer tu contraseña.", variant: "default" });
      setIsForgotPassword(false);
    } catch (err: unknown) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleView = (view: 'register' | 'login' | 'forgot') => {
    if (view === 'register') { setIsRegister(true); setIsForgotPassword(false); }
    if (view === 'login') { setIsRegister(false); setIsForgotPassword(false); }
    if (view === 'forgot') { setIsRegister(false); setIsForgotPassword(true); }
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img 
            src="/favicon.png" 
            alt="Logo MySportdate" 
            className="w-14 h-14 rounded-xl shadow-lg shadow-emerald-500/20 object-contain mx-auto mb-4" 
          />
          <h1 className="text-2xl font-extrabold text-secondary-foreground">MySportdate</h1>
          <p className="text-sm text-sidebar-foreground opacity-60 mt-1">
            {isForgotPassword 
              ? "Recuperá el acceso a tu cuenta"
              : isRegister ? "Creá tu cuenta de administrador" : "Ingresá a tu panel de administración"}
          </p>
        </div>
        
        <form onSubmit={isForgotPassword ? handleResetPassword : (isRegister ? handleRegister : handleLogin)} className="bg-card rounded-2xl p-6 shadow-xl space-y-4">
          
          {isRegister && !isForgotPassword && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Nombre de tu predio</label>
              <input type="text" value={facilityName} onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Ej: Complejo Deportivo Norte"
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-primary" />
            </div>
          )}
          
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@mipredio.com" required
              className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-primary" />
          </div>
          
          {!isForgotPassword && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-muted-foreground">Contraseña</label>
                {!isRegister && (
                  <button type="button" onClick={() => toggleView('forgot')} className="text-xs text-primary hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" minLength={6} required
                className="w-full px-4 py-2.5 rounded-xl border border-input bg-background text-sm outline-none focus:border-primary" />
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isForgotPassword ? "Enviar enlace" : (isRegister ? "Crear cuenta" : "Ingresar")}
          </button>
          
          <div className="pt-2 text-center">
            {isForgotPassword ? (
              <button type="button" onClick={() => toggleView('login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Volver al inicio de sesión
              </button>
            ) : (
              <button type="button" onClick={() => isRegister ? toggleView('login') : toggleView('register')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {isRegister ? "¿Ya tenés cuenta? Ingresá" : "¿No tenés cuenta? Registrate"}
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};

export default Login;