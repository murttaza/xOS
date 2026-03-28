import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
    theme: "system",
    setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
}: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(
        () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
    )

    useEffect(() => {
        const root = window.document.documentElement

        const applyTheme = (resolved: "light" | "dark") => {
            root.classList.remove("light", "dark")
            root.classList.add(resolved)
            // Update theme-color meta tag for iOS Safari
            const meta = document.querySelector('meta[name="theme-color"]:not([media])')
                || (() => { const m = document.createElement("meta"); m.name = "theme-color"; document.head.appendChild(m); return m; })();
            meta.setAttribute("content", resolved === "dark" ? "#000000" : "#f5f6f8");
        }

        if (theme === "system") {
            const mq = window.matchMedia("(prefers-color-scheme: dark)")
            applyTheme(mq.matches ? "dark" : "light")
            const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? "dark" : "light")
            mq.addEventListener("change", handler)
            return () => mq.removeEventListener("change", handler)
        }

        applyTheme(theme)
    }, [theme])

    const value = {
        theme,
        setTheme: (theme: Theme) => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
    }

    return (
        <ThemeProviderContext.Provider value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error("useTheme must be used within a ThemeProvider")

    return context
}
