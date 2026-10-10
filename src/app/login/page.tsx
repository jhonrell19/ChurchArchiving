'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {

  const router = useRouter()

  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const [loading, setLoading] =
    useState(false)

  const change = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }))

  }

  const submit = async (
    e: React.FormEvent
  ) => {

    e.preventDefault()

    setLoading(true)

    try {

      const res = await fetch(
        '/api/auth/login',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            email: form.email,
            password: form.password,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {

        alert(
          data.message ||
          'Login failed.'
        )

        return
      }

      /*
        IMPORTANT:

        Prisma Role values are:

        USER
        ADMIN
        BURIAL_ADMIN

        They are UPPERCASE.
      */

      switch (data.user.role) {

        case 'ADMIN':

          router.replace('/admin')

          break

        case 'BURIAL_ADMIN':

          router.replace('/burial-admin')

          break

        case 'USER':

          router.replace('/dashboard')

          break

        default:

          alert(
            'Unknown account role.'
          )

          return
      }

      router.refresh()

    } catch (error) {

      console.error(error)

      alert(
        'Something went wrong.'
      )

    } finally {

      setLoading(false)

    }
  }

  const inputCls = `
    w-full
    bg-white/5
    border
    border-gold/20
    rounded-lg
    px-4
    py-3
    font-body
    text-[15px]
    text-txt-lt
    outline-none
    placeholder:text-txt-md/40
    focus:border-gold/60
    transition-colors
    duration-200
  `

  return (

    <div className="
      min-h-screen
      bg-navy
      flex
      items-center
      justify-center
      px-6
      py-24
      relative
      overflow-hidden
    ">

      <div className="
        absolute
        inset-0
        bg-grid-gold
        pointer-events-none
      " />

      <div className="
        relative
        z-10
        w-full
        max-w-md
        bg-white/4
        border
        border-gold/20
        rounded-2xl
        px-10
        py-12
        backdrop-blur-sm
      ">

        <div className="text-center mb-8">

          <span className="
            block
            text-gold
            text-4xl
            mb-4
          ">
            ✝
          </span>

          <h1 className="
            font-display
            text-gold
            text-lg
            tracking-wide
            mb-2
          ">
            Iglesia Filipina Independiente
          </h1>

          <p className="
            font-body
            italic
            text-txt-md
            text-[13px]
          ">
            Parish Portal — Maragondon, Cavite
          </p>

        </div>

        <h2 className="
          text-center
          text-white
          text-xl
          mb-2
        ">
          Sign In
        </h2>

        <p className="
          text-center
          text-txt-md
          text-sm
          mb-8
        ">
          Enter your account credentials.
          Your account role will be detected automatically.
        </p>

        <form
          onSubmit={submit}
          className="flex flex-col gap-5"
        >

          <div>

            <label className="
              block
              text-gold/60
              mb-2
              text-sm
            ">
              Email Address
            </label>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              placeholder="your@email.com"
              required
              className={inputCls}
            />

          </div>

          <div>

            <div className="
              flex
              justify-between
              mb-2
            ">

              <label className="
                text-gold/60
                text-sm
              ">
                Password
              </label>

              <Link
                href="/forgot-password"
                className="
                  text-gold/50
                  hover:text-gold
                  text-xs
                "
              >
                Forgot password?
              </Link>

            </div>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={change}
              placeholder="••••••••"
              required
              className={inputCls}
            />

          </div>

          <button
            type="submit"
            disabled={loading}
            className="
              bg-gold
              text-navy
              py-3.5
              rounded-lg
              uppercase
              tracking-wider
              disabled:opacity-50
            "
          >

            {loading
              ? 'Signing In...'
              : 'Sign In'
            }

          </button>

        </form>

        <p className="
          text-center
          text-txt-md
          mt-7
          text-sm
        ">

          Don't have an account?{' '}

          <Link
            href="/register"
            className="
              text-gold
              underline
            "
          >
            Register
          </Link>

        </p>

      </div>

    </div>

  )
}