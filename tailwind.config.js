/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shadcn/UI Required Colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        primary: {
          DEFAULT: '#3482AE',
          50:  '#EBF4FB',
          100: '#D0E8F5',
          200: '#A1D1EB',
          300: '#72BAE1',
          400: '#43A3D7',
          500: '#3482AE',
          600: '#2A6B91',
          700: '#205474',
          800: '#163D57',
          900: '#0C263A',
        },

        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },

        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },

        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },

        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },

        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },

        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Your Custom Colors
        status: {
          pending:  '#fd9644',
          approved: '#42ba96',
          rejected: '#df4759',
          submitted:'#17a2b8',
          overdue:  '#83a9df',
          draft:    '#83a9df',
        },
        sidebar: '#3482AE',
      },

      fontFamily: {
        sans: ['Inter', 'Exo', 'sans-serif'],
        exo: ['Exo', 'sans-serif'],
      },

      boxShadow: {
        card: '0 1px 2.94px 0.06px rgba(4,26,55,0.16)',
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}