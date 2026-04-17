// src/types/commands.ts

import { MachineState } from './machine'

export type KeyboardKey =
  | 'Escape'
  | 'Space'
  | 'ArrowLeft'
  | 'ArrowRight'
  | 'ArrowUp'
  | 'KeyA'
  | 'KeyD'
  | 'KeyW'
  | 'KeyS'
  | 'KeyM'
  | 'KeyP'
  | 'KeyC'
  | 'Digit1'
  | 'Digit2'
  | 'Digit3'
  | 'Digit4'
  | 'Digit5'

export interface KeyCommand {
  key: KeyboardKey
  action: (...args: any[]) => void
  allowedStates?: readonly MachineState[] // Changed to accept readonly arrays
  preventDefault?: boolean
  description?: string
}

export interface CommandConfig {
  [key: string]: KeyCommand
}

export interface KeyboardState {
  [key: string]: boolean
}

export interface UseKeyboardCommandsOptions {
  preventDefault?: boolean
  allowRepeat?: boolean
  disabled?: boolean
}
