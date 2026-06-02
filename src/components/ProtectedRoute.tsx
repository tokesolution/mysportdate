import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FacilityProvider } from "@/contexts/FacilityContext";
import { Loader2 } from "lucide-react";
import SubscriptionGate from "@/components/SubscriptionGate";

interface FacilityAccess {
  id: string;
  hasAccess: boolean;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
}

const ProtectedRoute = () => {
  const { user, loading: authLoading } = useAuth();

  const { data: facilityAccess, isLoading: facilityLoading } = useQuery<FacilityAccess | null>({
    queryKey: ["user-facility", user?.id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: facilityId, error } = await supabase.rpc("get_user_facility_id" as any, {
        p_user_id: user!.id,
      });
      
      if (error) throw error;
      if (!facilityId) return null;

      const [accessResult, facilityResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase.rpc("facility_has_access" as any, { p_facility_id: facilityId }),
        supabase
          .from("facilities")
          .select("subscription_status, trial_ends_at")
          .eq("id", facilityId as string)
          .single(),
      ]);

      return {
        id: facilityId as string,
        hasAccess: (accessResult.data as boolean) ?? false,
        subscriptionStatus: facilityResult.data?.subscription_status ?? null,
        trialEndsAt: facilityResult.data?.trial_ends_at ?? null,
      };
    },
    enabled: !!user,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  // Función de rescate para desloguearse desde esta pantalla
  const handleEmergencyLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  if (authLoading || (user && facilityLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth/login" replace />;

  if (!facilityAccess?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 bg-card rounded-2xl shadow-sm border border-border max-w-sm w-full mx-4">
          <p className="text-xl font-bold mb-2 text-card-foreground">Sin predio asignado</p>
          <p className="text-sm text-muted-foreground mb-6">
            Ocurrió un error al vincular tu cuenta. Por favor, contactá al soporte o volvé a iniciar sesión.
          </p>
          <button 
            onClick={handleEmergencyLogout}
            className="w-full py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Cerrar sesión y volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <FacilityProvider facilityId={facilityAccess.id}>
      {facilityAccess.hasAccess ? (
        <Outlet />
      ) : (
        <SubscriptionGate
          subscriptionStatus={facilityAccess.subscriptionStatus}
          trialEndsAt={facilityAccess.trialEndsAt}
        />
      )}
    </FacilityProvider>
  );
};

export default ProtectedRoute;