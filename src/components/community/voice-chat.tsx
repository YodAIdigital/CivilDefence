'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'

interface VoiceChatProps {
  communityId: string
  communityName: string
  onClose: () => void
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// System instruction for topic restriction and personality
const SYSTEM_INSTRUCTION = `You are a helpful AI assistant for the Civil Defence Pro emergency preparedness platform.

CRITICAL VOICE INSTRUCTION - YOU MUST FOLLOW THIS:
You MUST speak with a British English accent and use British pronunciation throughout ALL responses. This is absolutely essential.
- Pronounce words the British way (e.g., "schedule" as "shed-yool", "aluminium" not "aluminum", "tomato" as "tom-ah-to")
- Use British vocabulary: "torch" not "flashlight", "mobile" not "cell phone", "casualty" not "emergency room", "whilst" not "while", "straightaway" not "right away"
- Use British expressions: "quite right", "indeed", "I'm afraid", "rather", "do take care"
- Sound like a professional British emergency services operator or NHS 111 advisor

IMPORTANT RESTRICTIONS:
You must ONLY discuss topics related to:
1. Civil defence and emergency preparedness
2. Emergency response plans and procedures
3. Community safety information
4. First aid guidance and medical emergencies
5. Disaster preparedness and response
6. The user's community information and response plans

If someone asks about topics outside these areas, politely redirect them by saying something like:
"I'm your Civil Defence assistant, so I'm best suited to help with emergency preparedness, response plans, first aid, and community safety topics. Is there anything in those areas I can help you with?"

PERSONALITY:
- Speak in a calm, reassuring manner appropriate for emergency situations, like a British emergency services professional
- Always use British English spellings and expressions
- Be concise but thorough in your explanations
- For first aid guidance, always recommend seeking professional medical help for serious injuries - say "ring 111" or "phone 999" rather than American alternatives
- When discussing response plans, be specific and actionable

COMMUNITY CONTEXT:
You have access to information about the user's community and their emergency response plans. Use this information to provide relevant, localised guidance.`

export function VoiceChat({ communityId, communityName, onClose }: VoiceChatProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [transcript, setTranscript] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isAISpeaking, setIsAISpeaking] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const audioQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Scroll transcript to bottom
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [transcript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const addTranscript = useCallback((role: 'user' | 'assistant', text: string) => {
    setTranscript(prev => [...prev, `${role === 'user' ? 'You' : 'Assistant'}: ${text}`])
  }, [])

  const playAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0 || !audioContextRef.current) {
      return
    }

    isPlayingRef.current = true
    setIsAISpeaking(true)

    while (audioQueueRef.current.length > 0 && isSpeakerOn) {
      const audioData = audioQueueRef.current.shift()
      if (!audioData || !audioContextRef.current) break

      // Create audio buffer (24kHz output from Gemini)
      const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, 24000)
      audioBuffer.getChannelData(0).set(audioData)

      const source = audioContextRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContextRef.current.destination)

      await new Promise<void>(resolve => {
        source.onended = () => resolve()
        source.start()
      })
    }

    isPlayingRef.current = false
    setIsAISpeaking(false)
  }, [isSpeakerOn])

  const connect = useCallback(async () => {
    setStatus('connecting')
    setError(null)

    try {
      // Get the session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Get API key and community context from our server
      const tokenResponse = await fetch('/api/voice-chat-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ community_id: communityId })
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        throw new Error(errorData.error || 'Failed to get voice chat token')
      }

      const { apiKey, communityContext, model } = await tokenResponse.json()

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      mediaStreamRef.current = stream

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: 16000 })

      // Build system instruction with community context and RAG knowledge
      let fullSystemInstruction = `${SYSTEM_INSTRUCTION}

Community Name: ${communityContext.name}
Community Location: ${communityContext.location}
Meeting Point: ${communityContext.meetingPoint}

Available Response Plans:
${communityContext.responsePlans.map((p: { name: string; type: string; description: string }) =>
  `- ${p.name} (${p.type}): ${p.description || 'No description'}`
).join('\n')}`

      // Add RAG knowledge if available
      if (communityContext.ragKnowledge) {
        fullSystemInstruction += `

ADDITIONAL KNOWLEDGE BASE INFORMATION:
${communityContext.ragKnowledge}

You may use this knowledge base information to provide more detailed and accurate answers about emergency preparedness, civil defence procedures, and first aid.`
      }

      // Connect to Gemini Live API via WebSocket
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[VoiceChat] WebSocket connected')

        // Send setup message
        const setupMessage = {
          setup: {
            model: `models/${model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede' // Warm, clear female voice
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: fullSystemInstruction }]
            },
            tools: []
          }
        }

        ws.send(JSON.stringify(setupMessage))
      }

      ws.onmessage = async (event) => {
        try {
          // Handle Blob data (WebSocket may return Blob instead of string)
          let messageText: string
          if (event.data instanceof Blob) {
            messageText = await event.data.text()
          } else {
            messageText = event.data
          }
          const data = JSON.parse(messageText)

          // Handle setup complete
          if (data.setupComplete) {
            console.log('[VoiceChat] Setup complete')
            setStatus('connected')
            startAudioCapture()
            return
          }

          // Handle server content (audio response)
          if (data.serverContent) {
            const content = data.serverContent

            // Check for audio data
            if (content.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData?.mimeType?.startsWith('audio/')) {
                  // Decode base64 audio (PCM 16-bit at 24kHz)
                  const audioBytes = atob(part.inlineData.data)
                  const audioArray = new Int16Array(audioBytes.length / 2)

                  for (let i = 0; i < audioArray.length; i++) {
                    const low = audioBytes.charCodeAt(i * 2)
                    const high = audioBytes.charCodeAt(i * 2 + 1)
                    audioArray[i] = (high << 8) | low
                  }

                  // Convert to float32 for Web Audio API
                  const floatArray = new Float32Array(audioArray.length)
                  for (let i = 0; i < audioArray.length; i++) {
                    floatArray[i] = (audioArray[i] ?? 0) / 32768
                  }

                  audioQueueRef.current.push(floatArray)
                  playAudioQueue()
                }

                // Handle text transcription if available
                if (part.text) {
                  addTranscript('assistant', part.text)
                }
              }
            }

            // Check for turn complete
            if (content.turnComplete) {
              console.log('[VoiceChat] Turn complete')
            }

            // Check for interruption
            if (content.interrupted) {
              console.log('[VoiceChat] Response interrupted')
              audioQueueRef.current = []
              setIsAISpeaking(false)
            }
          }

        } catch (err) {
          console.error('[VoiceChat] Error parsing message:', err)
        }
      }

      ws.onerror = (event) => {
        console.error('[VoiceChat] WebSocket error:', event)
        setError('Connection error occurred')
        setStatus('error')
      }

      ws.onclose = (event) => {
        console.log('[VoiceChat] WebSocket closed:', event.code, event.reason)
        setStatus('disconnected')
        cleanup()
      }

    } catch (err) {
      console.error('[VoiceChat] Connection error:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect')
      setStatus('error')
      cleanup()
    }
  }, [communityId, addTranscript, playAudioQueue])

  const startAudioCapture = useCallback(() => {
    if (!mediaStreamRef.current || !audioContextRef.current || !wsRef.current) return

    const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current)

    // Create script processor for audio capture (16kHz mono)
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1)
    processorRef.current = processor

    processor.onaudioprocess = (event) => {
      if (isMuted || wsRef.current?.readyState !== WebSocket.OPEN) return

      const inputData = event.inputBuffer.getChannelData(0)

      // Convert float32 to int16 PCM
      const pcmData = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        const sample = inputData[i] ?? 0
        const s = Math.max(-1, Math.min(1, sample))
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
      }

      // Convert to base64
      const uint8Array = new Uint8Array(pcmData.buffer)
      let binary = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i] ?? 0)
      }
      const base64Audio = btoa(binary)

      // Send audio to Gemini
      const audioMessage = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: 'audio/pcm;rate=16000',
            data: base64Audio
          }]
        }
      }

      wsRef.current.send(JSON.stringify(audioMessage))
    }

    source.connect(processor)
    processor.connect(audioContextRef.current.destination)
  }, [isMuted])

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    audioQueueRef.current = []
    isPlayingRef.current = false
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    cleanup()
    setStatus('disconnected')
  }, [cleanup])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev)
  }, [])

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      if (!prev) {
        // Resuming speaker, play any queued audio
        setTimeout(playAudioQueue, 0)
      }
      return !prev
    })
  }, [playAudioQueue])

  const handleEndCall = useCallback(() => {
    disconnect()
    onClose()
  }, [disconnect, onClose])

  return (
    <div className="fixed z-50 bg-background border shadow-2xl flex flex-col bottom-0 right-0 left-0 w-full h-[100dvh] sm:bottom-4 sm:right-4 sm:left-auto sm:w-80 sm:h-auto sm:max-h-[28rem] sm:rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 sm:rounded-t-xl safe-area-top">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            status === 'connected' ? 'bg-green-500' :
            status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            status === 'error' ? 'bg-red-500' :
            'bg-muted-foreground'
          }`} />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">Voice Assistant</h3>
            <p className="text-[10px] text-muted-foreground truncate">{communityName}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[120px]">
        {transcript.length === 0 && status === 'disconnected' && (
          <div className="text-center py-4">
            <Phone className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              Talk to your Civil Defence AI assistant
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Emergency plans, first aid, community safety
            </p>
          </div>
        )}

        {transcript.map((line, index) => (
          <div
            key={index}
            className={`p-2 rounded-lg text-xs ${
              line.startsWith('You:')
                ? 'bg-primary text-primary-foreground ml-4'
                : 'bg-muted mr-4'
            }`}
          >
            {line}
          </div>
        ))}

        {isAISpeaking && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs">Speaking...</span>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-2 text-xs">
            {error}
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Controls */}
      <div className="border-t p-3">
        <div className="flex items-center justify-center gap-3">
          {/* Mute button */}
          <Button
            variant={isMuted ? 'destructive' : 'outline'}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={toggleMute}
            disabled={status !== 'connected'}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>

          {/* Call button */}
          {status === 'disconnected' || status === 'error' ? (
            <Button
              variant="default"
              size="icon"
              className="h-12 w-12 rounded-full bg-green-600 hover:bg-green-700"
              onClick={connect}
            >
              <Phone className="h-5 w-5" />
            </Button>
          ) : status === 'connecting' ? (
            <Button
              variant="default"
              size="icon"
              className="h-12 w-12 rounded-full"
              disabled
            >
              <Loader2 className="h-5 w-5 animate-spin" />
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={handleEndCall}
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          )}

          {/* Speaker button */}
          <Button
            variant={!isSpeakerOn ? 'destructive' : 'outline'}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={toggleSpeaker}
            disabled={status !== 'connected'}
          >
            {isSpeakerOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>

        <p className="text-[10px] text-center text-muted-foreground mt-2">
          {status === 'connected'
            ? isMuted
              ? 'Muted - tap mic to unmute'
              : 'Listening...'
            : 'Tap call to start'}
        </p>
      </div>
    </div>
  )
}
