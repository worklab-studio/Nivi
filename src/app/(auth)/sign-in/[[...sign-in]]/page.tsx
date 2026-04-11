import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a]">
      <Link href="/" className="font-sans text-3xl font-bold text-white mb-10">
        Nivi
      </Link>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-[400px]',
            card: 'bg-transparent shadow-none border-none w-full',
            headerTitle: 'text-white text-2xl font-display',
            headerSubtitle: 'text-[#888]',
            socialButtonsBlockButton:
              'bg-[#1a1a1a] border-[#333] hover:bg-[#222] hover:border-[#444]',
            socialButtonsBlockButtonText: 'text-[#f0f0f0]',
            dividerLine: 'bg-[#333]',
            dividerText: 'text-[#666]',
            formFieldLabel: 'text-[#999]',
            formFieldInput:
              'bg-[#1a1a1a] border-[#333] text-white placeholder:text-[#555] focus:border-[#555] focus:ring-0',
            formButtonPrimary:
              'bg-white text-black hover:bg-[#e0e0e0] font-medium',
            footerAction: 'text-[#666]',
            footerActionLink: 'text-white hover:text-[#ccc]',
            formFieldInputShowPasswordButton: 'text-[#666] hover:text-[#999]',
            footer: 'hidden',
          },
        }}
      />
      <p className="mt-6 text-[13px] text-[#555]">
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className="text-white hover:text-[#ccc] transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  )
}
