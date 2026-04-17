// src/hooks/useKeyboardCommands.ts

import { useEffect, useRef, useCallback } from 'react'
import { KeyCommand, UseKeyboardCommandsOptions } from '@/types/commands'
import { useStateMachine } from '@/stores/stateMachine'
import { MachineState } from '@/types/machine'

export const useKeyboardCommands = (
  commands: KeyCommand | KeyCommand[] | null,
  deps: any[] = [], // Additional dependencies for the effect
  options: UseKeyboardCommandsOptions = {}
) => {
  const {
    preventDefault = true,
    allowRepeat = false,
    disabled = false,
  } = options

  const currentState = useStateMachine((state) => state.currentState)
  const pressedKeys = useRef<Set<string>>(new Set())

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if disabled or if repeating and repeat not allowed
      if (disabled || (!allowRepeat && event.repeat)) return

      // Ignore if target is an input element
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const commandArray = Array.isArray(commands) ? commands : [commands]

      for (const command of commandArray) {
        if (!command) continue

        // Check if command is allowed in current state
        if (
          command.allowedStates &&
          !command.allowedStates.includes(currentState as MachineState)
        ) {
          continue
        }

        // Match both the key and required modifiers
        if (event.code === command.key) {
          if (preventDefault || command.preventDefault) {
            event.preventDefault()
          }

          // Only execute if key wasn't already pressed (unless repeat is allowed)
          if (allowRepeat || !pressedKeys.current.has(event.code)) {
            command.action(event)
            pressedKeys.current.add(event.code)
          }
        }
      }
    },
    [commands, currentState, preventDefault, allowRepeat, disabled, ...deps]
  )

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    pressedKeys.current.delete(event.code)
  }, [])

  useEffect(() => {
    if (!commands || disabled) return

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      pressedKeys.current.clear()
    }
  }, [commands, handleKeyDown, handleKeyUp, disabled])
}

// Common game commands
export const GAME_COMMANDS = {
  MOVEMENT: {
    LEFT: {
      key: 'ArrowLeft' as const,
      action: (setKey: (key: string, value: number) => void) =>
        setKey('left', 1),
      description: 'Move Left',
      allowedStates: [MachineState.PLAYING] as const, // Explicitly type as const
    },
    RIGHT: {
      key: 'ArrowRight' as const,
      action: (setKey: (key: string, value: number) => void) =>
        setKey('right', 1),
      description: 'Move Right',
      allowedStates: [MachineState.PLAYING] as const,
    },
    UP: {
      key: 'ArrowUp' as const,
      action: (setKey: (key: string, value: number) => void) => setKey('up', 1),
      description: 'Thrust',
      allowedStates: [MachineState.PLAYING] as const,
    },
    SHOOT: {
      key: 'Space' as const,
      action: (setKey: (key: string, value: number) => void) =>
        setKey('space', 1),
      description: 'Fire',
      allowedStates: [MachineState.PLAYING] as const,
    },
  },
  GAME_CONTROL: {
    PAUSE: {
      key: 'Escape' as const,
      action: (setState: (state: MachineState) => void) =>
        setState(MachineState.PAUSED),
      description: 'Pause Game',
      allowedStates: [MachineState.PLAYING] as const,
    },
    RESUME: {
      key: 'Escape' as const,
      action: (setState: (state: MachineState) => void) =>
        setState(MachineState.PLAYING),
      description: 'Resume Game',
      allowedStates: [MachineState.PAUSED] as const,
    },
  },
} as const
