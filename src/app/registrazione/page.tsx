import { RegisterForm } from "@/features/auth/RegisterForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registrati",
};

export default function RegisterPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center pt-24 pb-12 px-4">
      <RegisterForm />
    </div>
  );
}
