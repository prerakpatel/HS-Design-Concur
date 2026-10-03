"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      // Dark toast on a light app so it reads at a glance; the icon carries the colour (green / red / amber / blue).
      style={
        {
          "--normal-bg": "var(--foreground)",
          "--normal-text": "var(--background)",
          "--normal-border": "transparent",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !shadow-[0_12px_32px_rgba(0,0,0,0.28)] !px-4 !py-3.5 !gap-3 !text-[15px] !leading-5 !font-medium",
          description: "!text-background/70 !font-normal",
          icon: "!m-0 !mt-px",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-brand",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
          actionButton: "!bg-background !text-foreground !font-medium",
          cancelButton: "!bg-background/15 !text-background",
          closeButton: "!bg-foreground !text-background !border-background/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
