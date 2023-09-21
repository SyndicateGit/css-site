"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DateTimePicker } from "../ui/date-time-picker/date-time-picker";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { createEvent, updateEvent } from "@/app/_actions";
import { CalendarDateTime } from "@internationalized/date";
import { FormDialog } from "../FormDialog";
import { useState } from "react";

const FormSchema = z.object({
  title: z
    .string({
      required_error: "A title is required.",
    })
    .nonempty(),
  description: z
    .string({
      required_error: "A description is required.",
    })
    .nonempty(),
  location: z.string().optional(),
  startDate: z.object(
    {
      year: z.number(),
      month: z.number(),
      day: z.number(),
      hour: z.number(),
      minute: z.number(),
    },
    {
      required_error: "A start date is required.",
    }
  ),
  endDate: z.object(
    {
      year: z.number(),
      month: z.number(),
      day: z.number(),
      hour: z.number(),
      minute: z.number(),
    },
    {
      required_error: "An end date is required.",
    }
  ),
});

interface EventFormProps {
  id?: number;
  initialValues?: z.infer<typeof FormSchema>;
  triggerButton: React.ReactNode;
}

export function EventFormDialog({ triggerButton, id, initialValues }: EventFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    // @ts-ignore
    resolver: zodResolver(FormSchema),
    defaultValues: initialValues || undefined,
  });

  const [isOpen, setIsOpen] = useState(false);

  function convertDate(
    date: {
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
    },
    adjustMonth = true
  ): [number, number, number, number, number] {
    return [date.year, adjustMonth ? date.month - 1 : date.month, date.day, date.hour, date.minute];
  }

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    const startDate = new Date(...convertDate(data.startDate));
    const endDate = new Date(...convertDate(data.endDate));

    const event: EventFormData = {
      title: data.title,
      description: data.description,
      location: data.location,
      startDate,
      endDate,
    };

    if (id) await updateEvent(event, id);
    else await createEvent(event);

    setIsOpen(false);
  }

  return (
    <FormDialog
      form={form}
      triggerButton={triggerButton}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      onSubmitAction={onSubmit}
      title={id ? "Edit Event" : "Create Event"}
      buttonText={id ? "Edit Event" : "Create Event"}
      pendingButtonText={id ? "Editing Event..." : "Creating Event..."}
      contentClassName="sm:max-w-[600px]">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <Input {...field} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <Input {...field} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="startDate"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Start Date</FormLabel>
            <DateTimePicker
              value={
                initialValues ? new CalendarDateTime(...convertDate(field.value, false)) : undefined
              }
              granularity={"minute"}
              onChange={field.onChange}
              label="Start Date"
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="endDate"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>End Date</FormLabel>
            <DateTimePicker
              value={
                initialValues ? new CalendarDateTime(...convertDate(field.value, false)) : undefined
              }
              granularity={"minute"}
              onChange={field.onChange}
              label="End Date"
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <Textarea className="h-[300px]" {...field} />
            <FormMessage />
          </FormItem>
        )}
      />
    </FormDialog>
  );
}