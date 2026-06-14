"use client"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  StickyNote,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  CalendarDays,
  Plus,
  Trash2
} from "lucide-react"
import { useNotesContext } from "@/contexts/NotesContext"
import { useCalendarEvents } from "@/hooks/useCalendarEvents"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from "date-fns"
import { Button } from "@/components/ui/button"
import CalendarStats from "@/components/calendar/CalendarStats"
import EventModal from "@/components/calendar/EventModal"
import WeekView from "@/components/calendar/WeekView"
import DayView from "@/components/calendar/DayView"
import AgendaView from "@/components/calendar/AgendaView"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { SyncStatusIndicator } from "@/components/utility/SyncStatusIndicator"

type ViewMode = "month" | "week" | "day" | "agenda"

const CalendarPage = () => {
  const router = useRouter()
  const { noteIndexes } = useNotesContext()
  const { events, createEvent, deleteEvent } = useCalendarEvents()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)

  const currentMonth = useMemo(() => startOfMonth(currentDate), [currentDate])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)

    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    return eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd,
    })
  }, [currentDate])

  /* -------- PERFORMANCE OPTIMIZATION -------- */

  const notesByDate = useMemo(() => {
    const map = new Map<string, typeof noteIndexes>()
    noteIndexes.forEach((note) => {
      const key = format(new Date(note.createdAt), "yyyy-MM-dd")
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(note)
    })
    return map
  }, [noteIndexes])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof events>()
    events.forEach((event) => {
      const key = format(new Date(event.date), "yyyy-MM-dd")
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(event)
    })
    return map
  }, [events])

  const notesForDate = (date: Date) =>
    notesByDate.get(format(date, "yyyy-MM-dd")) || []

  const eventsForDate = (date: Date) =>
    eventsByDate.get(format(date, "yyyy-MM-dd")) || []

  const selectedDateNotes = selectedDate ? notesForDate(selectedDate) : []
  const selectedDateEvents = selectedDate ? eventsForDate(selectedDate) : []

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  /* -------- NAVIGATION -------- */

  const navigate = (direction: "prev" | "next") => {

    if (viewMode === "month" || viewMode === "agenda") {
      setCurrentDate(
        direction === "prev"
          ? subMonths(currentDate, 1)
          : addMonths(currentDate, 1)
      )
    }

    else if (viewMode === "week") {
      setCurrentDate(
        direction === "prev"
          ? subWeeks(currentDate, 1)
          : addWeeks(currentDate, 1)
      )
    }

    else {
      setCurrentDate(
        direction === "prev"
          ? subDays(currentDate, 1)
          : addDays(currentDate, 1)
      )
    }

  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  const handleAddEvent = () => {

    if (!selectedDate) {
      setSelectedDate(new Date())
    }

    setIsEventModalOpen(true)
  }

  const handleSaveEvent = (eventData: any) => {

    createEvent({
      ...eventData,
      date: (selectedDate || new Date()).toISOString(),
    })

  }

  const handleNoteClick = (noteId: string) => {
    router.push(`/note/ideas/${noteId}`)
  }

  /* -------- VIEW MODES -------- */

  const viewModes = [
    { id: "month", icon: LayoutGrid, label: "Month" },
    { id: "week", icon: CalendarDays, label: "Week" },
    { id: "day", icon: CalendarIcon, label: "Day" },
    { id: "agenda", icon: List, label: "Agenda" },
  ]

  const getTitle = () => {
    if (viewMode === "day")
      return format(currentDate, "EEEE, MMMM d, yyyy")
    if (viewMode === "week")
      return `${format(startOfWeek(currentDate), "MMM d")} - ${format(
        endOfWeek(currentDate),
        "MMM d, yyyy"
      )}`
    return format(currentDate, "MMMM yyyy")
  }

  return (
    <div className="flex-1 h-full bg-background overflow-y-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto p-2 sm:p-8">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-20 backdrop-blur-md bg-background/70 border-b border-border pb-4 pt-2 mb-8"
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Calendar
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    View and manage your schedule
                  </p>
                </div>
                <SyncStatusIndicator/>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddEvent}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Event
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-fit">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as ViewMode)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${
                      viewMode === mode.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }
                  `}
                >
                  <mode.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {mode.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
        {/* STATS */}
        <CalendarStats
          notes={noteIndexes}
          events={events}
          currentMonth={currentMonth}
        />
        {/* NAVIGATION */}
        <div className="flex items-center justify-between mb-4 mt-8">
          <button
            onClick={() => navigate("prev")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold">
            {getTitle()}
          </h2>
          <button
            onClick={() => navigate("next")}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {/* MONTH VIEW */}
        {viewMode === "month" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const dayNotes = notesForDate(day)
                  const dayEvents = eventsForDate(day)
                  const isCurrentMonth = isSameMonth(day, currentDate)
                  const isSelected =
                    selectedDate && isSameDay(day, selectedDate)
                  const isToday = isSameDay(day, new Date())
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => handleDateClick(day)}
                      onDoubleClick={() => {
                        setSelectedDate(day)
                        setIsEventModalOpen(true)
                      }}
                      className={`aspect-square p-1 rounded-lg text-sm flex flex-col items-center transition-colors
                      ${isCurrentMonth ? "text-foreground" : "text-muted-foreground/30"}
                      ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}
                      ${isToday && !isSelected ? "ring-2 ring-primary" : ""}
                      `}
                    >
                      <span className="mb-1">
                        {format(day, "d")}
                      </span>
                      <div className="flex gap-0.5">
                        {dayNotes.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        {dayEvents.slice(0, 2).map((event) => (
                          <span
                            key={event.id}
                            className={`w-1.5 h-1.5 rounded-full ${event.color}`}
                          />
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            {/* SIDEBAR DETAILS */}
            <div className="bg-card rounded-xl border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">
                {selectedDate
                  ? format(selectedDate, "MMMM d, yyyy")
                  : "Select a date"}
              </h3>
              {selectedDate ? (
                <div className="space-y-4">
                  {selectedDateEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg ${event.color} text-white flex items-center justify-between group`}
                    >
                      <div>
                        <p className="font-medium">
                          {event.title}
                        </p>
                        {event.time && (
                          <p className="text-xs opacity-80">
                            {event.time}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {selectedDateNotes.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => handleNoteClick(note.id)}
                      className="p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
                    >
                      <h4 className="font-medium truncate">
                        {note.title || "Untitled"}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Note created at{" "}
                        {format(new Date(note.createdAt), "h:mm a")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-sm">
                  Pick a day to view details
                </p>
              )}
            </div>
          </div>
        )}
        {viewMode === "week" && (
          <WeekView
            currentDate={currentDate}
            notes={noteIndexes}
            events={events}
            onDateClick={handleDateClick}
            onNoteClick={handleNoteClick}
            onDeleteEvent={deleteEvent}
          />
        )}
        {viewMode === "day" && (
          <DayView
            currentDate={currentDate}
            notes={noteIndexes}
            events={events}
            onAddEvent={handleAddEvent}
            onNoteClick={handleNoteClick}
            onDeleteEvent={deleteEvent}
          />
        )}
        {viewMode === "agenda" && (
          <AgendaView
            currentMonth={currentMonth}
            notes={noteIndexes}
            events={events}
            onNoteClick={handleNoteClick}
            onDeleteEvent={deleteEvent}
          />
        )}
      </div>
      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
        selectedDate={selectedDate || new Date()}
      />
    </div>
  )
}
export default CalendarPage