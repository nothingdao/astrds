// src/types/forms/index.ts

export interface FormProps {
  isVisible: boolean
  selectedOption: string | null // Assuming selectedOption can be a string or null
  onSelect: (paymentType: string) => void
  onSubmit: () => void
  onClose: () => void
  isVerifying: boolean
  error: string | null // Assuming error can be a string or null
}
