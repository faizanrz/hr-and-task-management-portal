import Image from 'next/image'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface-dark items-center justify-center relative">
        <div className="text-center">
          <Image
            src="/logo.png"
            alt="Your Company"
            width={120}
            height={108}
            className="mx-auto mb-6"
          />
          <h2 className="text-2xl font-semibold text-white">HR Portal</h2>
          <p className="text-sm text-gray-500 mt-2">Your Company</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-surface-mid px-4">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
