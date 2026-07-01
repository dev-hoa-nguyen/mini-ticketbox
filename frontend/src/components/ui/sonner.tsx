import { Toaster as SonnerToaster } from "sonner"

/**
 * Toast toàn cục. `richColors` cho toast lỗi màu đỏ (destructive),
 * `closeButton` để user chủ động đóng khi mạng lag dồn nhiều thông báo.
 */
function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-lg border border-border",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
