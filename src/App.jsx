import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "sonner"

function App() {
  return (
    <>
      <Pages />
      <Toaster
        position="bottom-right"
        closeButton
        richColors={false}
        toastOptions={{
          classNames: {
            toast: "!bg-gray-900 !text-white !border-gray-800 !shadow-lg !text-[13px]",
            title: "!text-white !font-medium",
            description: "!text-gray-300 !text-[12px]",
            success: "!bg-gray-900 !text-white !border-gray-800",
            error: "!bg-red-600 !text-white !border-red-700",
            warning: "!bg-amber-600 !text-white !border-amber-700",
            actionButton: "!bg-white !text-gray-900",
            cancelButton: "!bg-gray-700 !text-gray-100",
            closeButton: "!bg-gray-800 !text-gray-300 !border-gray-700",
          },
        }}
      />
    </>
  )
}

export default App
