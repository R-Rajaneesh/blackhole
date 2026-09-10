import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, Plus, BookOpen, Sun, Moon } from 'lucide-react'

import { buildDnsPacket, parseDnsPacket, generateDigOutput, toHex, hexDump, DnsFormValues, DnsQuestion } from './lib/dns'

export default function App() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('dns-builder-theme') as 'light' | 'dark'
      if (savedTheme) return savedTheme
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    }
    return 'dark'
  })
  
  const [form, setForm] = useState<DnsFormValues>(() => {
    let savedTargetIp = '8.8.8.8'
    let savedTargetPort = 53
    let savedUseCompression = false
    if (typeof window !== 'undefined') {
      try {
        const savedConfig = localStorage.getItem('dns-target-config')
        if (savedConfig) {
          const parsed = JSON.parse(savedConfig)
          if (parsed.targetIp) savedTargetIp = parsed.targetIp
          if (parsed.targetPort) savedTargetPort = parsed.targetPort
          if (parsed.useCompression !== undefined) savedUseCompression = parsed.useCompression
        }
      } catch (e) {}
    }
    return {
      id: 'AAAA',
      qr: 0,
      opcode: 0,
      aa: 0,
      tc: 0,
      rd: 1,
      ra: 0,
      z: 0,
      rcode: 0,
      qdcount: 1,
      ancount: 0,
      nscount: 0,
      arcount: 0,
      questions: [{ qname: 'google.com', qtype: 1, qclass: 1 }],
      targetIp: savedTargetIp,
      targetPort: savedTargetPort,
      useCompression: savedUseCompression
    }
  })

  const [reqHex, setReqHex] = useState('')
  const [reqParsed, setReqParsed] = useState<any>(null)
  
  const [resHex, setResHex] = useState('')
  const [resParsed, setResParsed] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Handle Theme Toggle
  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('dns-builder-theme', theme)
  }, [theme])

  // Save Target Server State
  useEffect(() => {
    localStorage.setItem('dns-target-config', JSON.stringify({
      targetIp: form.targetIp,
      targetPort: form.targetPort,
      useCompression: form.useCompression
    }))
  }, [form.targetIp, form.targetPort, form.useCompression])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const updateForm = (key: keyof DnsFormValues, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateQuestion = (index: number, key: keyof DnsQuestion, value: any) => {
    const q = [...form.questions]
    q[index] = { ...q[index], [key]: value }
    setForm(prev => ({ ...prev, questions: q, qdcount: q.length }))
  }

  const addQuestion = () => {
    setForm(prev => {
      const q = [...prev.questions, { qname: '', qtype: 1, qclass: 1 }]
      return { ...prev, questions: q, qdcount: q.length }
    })
  }

  const removeQuestion = (index: number) => {
    setForm(prev => {
      const q = prev.questions.filter((_, i) => i !== index)
      return { ...prev, questions: q, qdcount: q.length }
    })
  }

  useEffect(() => {
    try {
      const packet = buildDnsPacket(form)
      setReqHex(toHex(packet))
      setReqParsed(parseDnsPacket(packet))
    } catch (e) {
      console.error(e)
    }
  }, [form])

  const sendRequest = async () => {
    setLoading(true)
    setError('')
    setResHex('')
    setResParsed(null)

    try {
      const packet = buildDnsPacket(form)
      const res = await fetch('/api/send-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hexPacket: toHex(packet),
          targetIp: form.targetIp,
          targetPort: form.targetPort
        })
      })
      
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      
      setResHex(data.responseHex)
      const resBytes = new Uint8Array(data.responseHex.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)))
      setResParsed(parseDnsPacket(resBytes))
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const LabelWithTooltip = ({ label, tooltip }: { label: string, tooltip: string }) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Label className="text-xs text-muted-foreground border-b border-dotted cursor-help w-fit">{label}</Label>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs"><p>{tooltip}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  return (
    <div className="flex flex-col h-screen w-full p-4 gap-4 bg-background text-foreground transition-colors duration-200">
      {/* Header */}
      <header className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DNS Request Builder</h1>
          <p className="text-sm text-muted-foreground">Construct, send, and inspect raw DNS packets. Hover over labels for quick tooltips.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="text-foreground border-border hover:bg-muted" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-primary border-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                <BookOpen className="w-4 h-4 mr-2" /> View RFC 1035 Docs
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">RFC 1035 Simplified Documentation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-muted-foreground">
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-1">DNS Packet Layout</h3>
                
                <p className="font-semibold text-foreground mt-4 mb-2">Message Format (Sections)</p>
                <div className="relative w-full overflow-auto border border-border rounded-md">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b bg-muted/50">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[150px]">Section</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[150px]">Size</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">Header</td>
                        <td className="p-3 px-4 align-middle">12 Bytes</td>
                        <td className="p-3 px-4 align-middle">Fixed length header containing flags and counts</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">Question</td>
                        <td className="p-3 px-4 align-middle">Variable</td>
                        <td className="p-3 px-4 align-middle">The question for the name server (QNAME, QTYPE, QCLASS)</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">Answer</td>
                        <td className="p-3 px-4 align-middle">Variable</td>
                        <td className="p-3 px-4 align-middle">Resource Records answering the question</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">Authority</td>
                        <td className="p-3 px-4 align-middle">Variable</td>
                        <td className="p-3 px-4 align-middle">Resource Records pointing toward an authority</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">Additional</td>
                        <td className="p-3 px-4 align-middle">Variable</td>
                        <td className="p-3 px-4 align-middle">Resource Records holding additional information</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="font-semibold text-foreground mt-6 mb-2">Header Format</p>
                <div className="relative w-full overflow-auto border border-border rounded-md">
                  <table className="w-full caption-bottom text-sm">
                    <thead className="[&_tr]:border-b bg-muted/50">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[150px]">Field</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground w-[150px]">Size (Bits)</th>
                        <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="[&_tr:last-child]:border-0">
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">ID</td>
                        <td className="p-3 px-4 align-middle">16 bits</td>
                        <td className="p-3 px-4 align-middle">Transaction Identifier</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">QR</td>
                        <td className="p-3 px-4 align-middle">1 bit</td>
                        <td className="p-3 px-4 align-middle">Query (0) or Response (1)</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">Opcode</td>
                        <td className="p-3 px-4 align-middle">4 bits</td>
                        <td className="p-3 px-4 align-middle">Standard (0), Inverse (1), Status (2)</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">AA</td>
                        <td className="p-3 px-4 align-middle">1 bit</td>
                        <td className="p-3 px-4 align-middle">Authoritative Answer</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">TC</td>
                        <td className="p-3 px-4 align-middle">1 bit</td>
                        <td className="p-3 px-4 align-middle">Truncated Message</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">RD</td>
                        <td className="p-3 px-4 align-middle">1 bit</td>
                        <td className="p-3 px-4 align-middle">Recursion Desired</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">RA</td>
                        <td className="p-3 px-4 align-middle">1 bit</td>
                        <td className="p-3 px-4 align-middle">Recursion Available</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">Z</td>
                        <td className="p-3 px-4 align-middle">3 bits</td>
                        <td className="p-3 px-4 align-middle">Reserved (Must be zero)</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">RCODE</td>
                        <td className="p-3 px-4 align-middle">4 bits</td>
                        <td className="p-3 px-4 align-middle">Response Code (e.g. 0 = No Error, 3 = Name Error)</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">QDCOUNT</td>
                        <td className="p-3 px-4 align-middle">16 bits</td>
                        <td className="p-3 px-4 align-middle">Number of questions</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">ANCOUNT</td>
                        <td className="p-3 px-4 align-middle">16 bits</td>
                        <td className="p-3 px-4 align-middle">Number of answer resource records</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">NSCOUNT</td>
                        <td className="p-3 px-4 align-middle">16 bits</td>
                        <td className="p-3 px-4 align-middle">Number of authority resource records</td>
                      </tr>
                      <tr className="border-b transition-colors hover:bg-muted/50">
                        <td className="p-3 px-4 align-middle font-mono font-medium">ARCOUNT</td>
                        <td className="p-3 px-4 align-middle">16 bits</td>
                        <td className="p-3 px-4 align-middle">Number of additional resource records</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-1 mt-6">Header Flags</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">ID:</strong> A 16-bit identifier assigned by the program that generates any kind of query. This identifier is copied the corresponding reply and can be used by the requester to match up replies to outstanding queries.</li>
                  <li><strong className="text-foreground">QR:</strong> A one bit field that specifies whether this message is a query (0), or a response (1).</li>
                  <li><strong className="text-foreground">Opcode:</strong> A four bit field that specifies kind of query in this message. 0 = Standard query (QUERY), 1 = Inverse query (IQUERY), 2 = Server status request (STATUS).</li>
                  <li><strong className="text-foreground">AA (Authoritative Answer):</strong> Valid in responses, specifies that the responding name server is an authority for the domain name in question section.</li>
                  <li><strong className="text-foreground">TC (TrunCation):</strong> Specifies that this message was truncated due to length greater than that permitted on the transmission channel.</li>
                  <li><strong className="text-foreground">RD (Recursion Desired):</strong> Directs the name server to pursue the query recursively.</li>
                  <li><strong className="text-foreground">RA (Recursion Available):</strong> Set or cleared in a response, denotes whether recursive query support is available in the name server.</li>
                  <li><strong className="text-foreground">Z:</strong> Reserved for future use. Must be zero in all queries and responses.</li>
                  <li><strong className="text-foreground">RCODE (Response code):</strong> 0 = No error, 1 = Format error, 2 = Server failure, 3 = Name Error, 4 = Not Implemented, 5 = Refused.</li>
                </ul>
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-1 mt-4">Record Types (QTYPE)</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">A (1):</strong> a host address (IPv4)</li>
                  <li><strong className="text-foreground">NS (2):</strong> an authoritative name server</li>
                  <li><strong className="text-foreground">CNAME (5):</strong> the canonical name for an alias</li>
                  <li><strong className="text-foreground">SOA (6):</strong> marks the start of a zone of authority</li>
                  <li><strong className="text-foreground">PTR (12):</strong> a domain name pointer</li>
                  <li><strong className="text-foreground">MX (15):</strong> mail exchange</li>
                  <li><strong className="text-foreground">TXT (16):</strong> text strings</li>
                  <li><strong className="text-foreground">AAAA (28):</strong> a host address (IPv6)</li>
                  <li><strong className="text-foreground">SRV (33):</strong> service record</li>
                  <li><strong className="text-foreground">ANY (255):</strong> A request for all records</li>
                </ul>
                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-1 mt-4">Record Classes (QCLASS)</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong className="text-foreground">IN (1):</strong> the Internet</li>
                  <li><strong className="text-foreground">CS (2):</strong> the CSNET class (Obsolete)</li>
                  <li><strong className="text-foreground">CH (3):</strong> the CHAOS class</li>
                  <li><strong className="text-foreground">HS (4):</strong> Hesiod</li>
                  <li><strong className="text-foreground">ANY (255):</strong> any class</li>
                </ul>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Layout */}
      <div className="grid grid-cols-2 gap-4 flex-grow min-h-0">
        
        {/* Left Panel */}
        <Card className="flex flex-col min-h-0 bg-card border-border shadow-sm">
          <CardHeader className="py-3 px-4 border-b border-border shrink-0">
            <CardTitle className="text-base font-semibold">Header Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-grow min-h-0 p-4 gap-4 overflow-hidden">
            <div className="grid grid-cols-5 gap-3 shrink-0">
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="ID (Hex)" tooltip="A 16-bit identifier." />
                <Input className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.id} onChange={e => updateForm('id', e.target.value)} maxLength={4} />
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="QR" tooltip="0 = Query, 1 = Response" />
                <Select value={form.qr.toString()} onValueChange={v => updateForm('qr', parseInt(v))}>
                  <SelectTrigger className="h-8 bg-muted border-border text-xs focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">0 - Query</SelectItem><SelectItem value="1">1 - Response</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="Opcode" tooltip="0=Standard, 1=Inverse, 2=Status" />
                <Input type="number" className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.opcode} onChange={e => updateForm('opcode', parseInt(e.target.value))} min={0} max={15} />
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="AA" tooltip="Authoritative Answer" />
                <Select value={form.aa.toString()} onValueChange={v => updateForm('aa', parseInt(v))}>
                  <SelectTrigger className="h-8 bg-muted border-border text-xs focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="TC" tooltip="Truncation" />
                <Select value={form.tc.toString()} onValueChange={v => updateForm('tc', parseInt(v))}>
                  <SelectTrigger className="h-8 bg-muted border-border text-xs focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem></SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="RD" tooltip="Recursion Desired" />
                <Select value={form.rd.toString()} onValueChange={v => updateForm('rd', parseInt(v))}>
                  <SelectTrigger className="h-8 bg-muted border-border text-xs focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="RA" tooltip="Recursion Available" />
                <Select value={form.ra.toString()} onValueChange={v => updateForm('ra', parseInt(v))}>
                  <SelectTrigger className="h-8 bg-muted border-border text-xs focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="0">0</SelectItem><SelectItem value="1">1</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="Z" tooltip="Reserved, must be 0" />
                <Input type="number" className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.z} onChange={e => updateForm('z', parseInt(e.target.value))} min={0} max={7} />
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="RCODE" tooltip="Response Code" />
                <Input type="number" className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.rcode} onChange={e => updateForm('rcode', parseInt(e.target.value))} min={0} max={15} />
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="QDCOUNT" tooltip="Question Count" />
                <Input type="number" className="h-8 bg-muted border-border text-xs opacity-60" value={form.qdcount} readOnly />
              </div>

              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="ANCOUNT" tooltip="Answer Count" />
                <Input type="number" className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.ancount} onChange={e => updateForm('ancount', parseInt(e.target.value))} min={0} />
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="NSCOUNT" tooltip="Authority Count" />
                <Input type="number" className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.nscount} onChange={e => updateForm('nscount', parseInt(e.target.value))} min={0} />
              </div>
              <div className="flex flex-col gap-1">
                <LabelWithTooltip label="ARCOUNT" tooltip="Additional Count" />
                <Input type="number" className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.arcount} onChange={e => updateForm('arcount', parseInt(e.target.value))} min={0} />
              </div>
            </div>

            {/* Questions */}
            <div className="flex justify-between items-center mt-2 mb-2 shrink-0">
              <h2 className="text-base font-semibold text-foreground">Questions</h2>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addQuestion}><Plus className="w-3 h-3 mr-1" /> Add</Button>
            </div>
            
            <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 px-3 pb-1 shrink-0">
              <Label className="text-xs font-semibold text-muted-foreground">Domain Name</Label>
              <Label className="text-xs font-semibold text-muted-foreground">Type (QTYPE)</Label>
              <Label className="text-xs font-semibold text-muted-foreground">Class (QCLASS)</Label>
              <div className="w-8"></div>
            </div>

            <ScrollArea className="flex-grow border border-border rounded-md bg-muted/30">
              <div className="p-2">
                {form.questions.map((q, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center mb-2 pb-2 border-b border-border/50 last:border-0 last:mb-0 last:pb-0 pt-1">
                    <div className="flex flex-col gap-1">
                      <Input className="h-8 bg-background border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" placeholder="e.g. google.com" value={q.qname} onChange={e => updateQuestion(i, 'qname', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Select value={q.qtype.toString()} onValueChange={v => updateQuestion(i, 'qtype', parseInt(v))}>
                        <SelectTrigger className="h-8 bg-background border-border text-xs focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">A (1)</SelectItem>
                          <SelectItem value="2">NS (2)</SelectItem>
                          <SelectItem value="5">CNAME (5)</SelectItem>
                          <SelectItem value="6">SOA (6)</SelectItem>
                          <SelectItem value="12">PTR (12)</SelectItem>
                          <SelectItem value="15">MX (15)</SelectItem>
                          <SelectItem value="16">TXT (16)</SelectItem>
                          <SelectItem value="28">AAAA (28)</SelectItem>
                          <SelectItem value="33">SRV (33)</SelectItem>
                          <SelectItem value="255">ANY (255)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Select value={q.qclass.toString()} onValueChange={v => updateQuestion(i, 'qclass', parseInt(v))}>
                        <SelectTrigger className="h-8 bg-background border-border text-xs focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">IN (1)</SelectItem>
                          <SelectItem value="2">CS (2)</SelectItem>
                          <SelectItem value="3">CH (3)</SelectItem>
                          <SelectItem value="4">HS (4)</SelectItem>
                          <SelectItem value="255">ANY (255)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="destructive" size="icon" className="h-8 w-8 shadow-sm" onClick={() => removeQuestion(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Target Server */}
            <div className="shrink-0 mt-2">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-base font-semibold text-foreground">Target Server</h2>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer hover:text-primary transition-colors">
                  <input type="checkbox" className="h-4 w-4 rounded border-primary text-primary focus:ring-primary" checked={form.useCompression} onChange={e => updateForm('useCompression', e.target.checked)} />
                  Enable Compression
                </label>
              </div>
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <LabelWithTooltip label="IP Address" tooltip="DNS Server IP" />
                  <Input className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.targetIp} onChange={e => updateForm('targetIp', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <LabelWithTooltip label="Port" tooltip="Server UDP Port" />
                  <Input type="number" className="h-8 bg-muted border-border text-xs focus-visible:ring-1 focus-visible:ring-primary" value={form.targetPort} onChange={e => updateForm('targetPort', parseInt(e.target.value))} />
                </div>
                <Button onClick={sendRequest} disabled={loading} className="h-8 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
                  {loading ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel */}
        <div className="flex flex-col gap-4 min-h-0">
          <Card className="flex flex-col flex-1 min-h-0 bg-card border-border shadow-sm">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-base font-semibold">Request</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 min-h-0 p-0">
              <Tabs defaultValue="raw" className="flex flex-col flex-1 min-h-0">
                <TabsList className="bg-muted border-b border-border rounded-none h-10 w-full justify-start px-4">
                  <TabsTrigger value="raw" className="data-[state=active]:bg-background">Raw Data</TabsTrigger>
                  <TabsTrigger value="dig" className="data-[state=active]:bg-background">Dig Style</TabsTrigger>
                  <TabsTrigger value="format" className="data-[state=active]:bg-background">Formatted</TabsTrigger>
                </TabsList>
                <div className="flex-1 min-h-0 relative">
                  <TabsContent value="raw" className="absolute inset-0 m-0 border-0 data-[state=active]:flex"><ScrollArea className="flex-1 bg-background"><pre className="p-4 text-xs font-mono text-muted-foreground">{hexDump(reqHex)}</pre></ScrollArea></TabsContent>
                  <TabsContent value="dig" className="absolute inset-0 m-0 border-0 data-[state=active]:flex"><ScrollArea className="flex-1 bg-background"><pre className="p-4 text-xs font-mono text-muted-foreground">{generateDigOutput(reqParsed)}</pre></ScrollArea></TabsContent>
                  <TabsContent value="format" className="absolute inset-0 m-0 border-0 data-[state=active]:flex"><ScrollArea className="flex-1 bg-background"><pre className="p-4 text-xs font-mono text-muted-foreground">{JSON.stringify(reqParsed, null, 2)}</pre></ScrollArea></TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="flex flex-col flex-1 min-h-0 bg-card border-border shadow-sm">
            <CardHeader className="py-2 px-4 border-b border-border">
              <CardTitle className="text-base font-semibold">Response</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 min-h-0 p-0">
              <Tabs defaultValue="raw" className="flex flex-col flex-1 min-h-0">
                <TabsList className="bg-muted border-b border-border rounded-none h-10 w-full justify-start px-4">
                  <TabsTrigger value="raw" className="data-[state=active]:bg-background">Raw Data</TabsTrigger>
                  <TabsTrigger value="dig" className="data-[state=active]:bg-background">Dig Style</TabsTrigger>
                  <TabsTrigger value="format" className="data-[state=active]:bg-background">Formatted</TabsTrigger>
                </TabsList>
                <div className="flex-1 min-h-0 relative">
                  <TabsContent value="raw" className="absolute inset-0 m-0 border-0 data-[state=active]:flex">
                    <ScrollArea className="flex-1 bg-background">
                      <pre className="p-4 text-xs font-mono text-muted-foreground">
                        {error ? `Error: ${error}` : (resHex ? hexDump(resHex) : "Waiting for response...")}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="dig" className="absolute inset-0 m-0 border-0 data-[state=active]:flex">
                    <ScrollArea className="flex-1 bg-background">
                      <pre className="p-4 text-xs font-mono text-muted-foreground">
                        {error ? `Error: ${error}` : (resParsed ? generateDigOutput(resParsed) : "Waiting for response...")}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="format" className="absolute inset-0 m-0 border-0 data-[state=active]:flex">
                    <ScrollArea className="flex-1 bg-background">
                      <pre className="p-4 text-xs font-mono text-muted-foreground">
                        {error ? `Error: ${error}` : (resParsed ? JSON.stringify(resParsed, null, 2) : "Waiting for response...")}
                      </pre>
                    </ScrollArea>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
