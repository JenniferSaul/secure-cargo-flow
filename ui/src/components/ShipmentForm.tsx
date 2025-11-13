import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Package, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useSecureCargoFlow } from "@/hooks/useSecureCargoFlow";
import { useAccount } from "wagmi";

const shipmentSchema = z.object({
  trackingId: z.string()
    .min(6, "Tracking ID must be at least 6 characters")
    .regex(/^[A-Z0-9-]+$/, "Tracking ID can only contain uppercase letters, numbers, and hyphens"),
  origin: z.string()
    .min(2, "Origin must be at least 2 characters")
    .max(50, "Origin cannot exceed 50 characters"),
  destination: z.string()
    .min(2, "Destination must be at least 2 characters")
    .max(50, "Destination cannot exceed 50 characters"),
  weight: z.string()
    .min(1, "Weight is required")
    .regex(/^\d+(\.\d{1,2})?$/, "Weight must be a valid number with max 2 decimal places")
    .refine((val) => {
      const num = parseFloat(val);
      return num > 0 && num <= 100000; // Max 100 tons
    }, "Weight must be between 0.01 and 100,000 kg"),
  contents: z.string()
    .min(3, "Contents description must be at least 3 characters")
    .max(200, "Contents description cannot exceed 200 characters"),
  estimatedDelivery: z.string()
    .min(1, "Estimated delivery date is required")
    .refine((val) => {
      const date = new Date(val);
      const now = new Date();
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 2); // Max 2 years in future
      return date > now && date <= maxDate;
    }, "Estimated delivery must be in the future but within 2 years"),
});

type ShipmentFormValues = z.infer<typeof shipmentSchema>;

export const ShipmentForm = () => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isConnected } = useAccount();
  const { createShipment, addCargoEvent, isPending } = useSecureCargoFlow();

  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      trackingId: "",
      origin: "",
      destination: "",
      weight: "",
      contents: "",
      estimatedDelivery: "",
    },
  });

  const onSubmit = async (data: ShipmentFormValues) => {
    if (!isConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsSubmitting(true);
    try {
      // Parse weight (remove "kg" if present)
      const weightValue = parseFloat(data.weight.replace(/[^0-9.]/g, ""));
      if (isNaN(weightValue)) {
        toast.error("Invalid weight value");
        return;
      }

      // Convert date to timestamp
      const estimatedDeliveryTimestamp = Math.floor(
        new Date(data.estimatedDelivery).getTime() / 1000
      );

      // Create shipment
      console.log("Creating shipment...", data.trackingId);
      await createShipment(
        data.trackingId,
        data.origin,
        data.destination,
        estimatedDeliveryTimestamp
      );
      console.log("Shipment created, waiting for confirmation...");
      
      // Wait a bit for transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Add initial cargo event with encrypted weight
      console.log("Adding initial cargo event...");
      let eventAdded = false;
      try {
        await addCargoEvent(
          data.trackingId,
          data.origin,
          0, // ShipmentStatus.Created
          weightValue, // First event, use provided weight
          data.contents
        );
        console.log("Cargo event added successfully");
        eventAdded = true;
        // Wait a bit more for event transaction to be mined
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (eventError) {
        console.error("Failed to add cargo event:", eventError);
        console.error("Error details:", eventError instanceof Error ? eventError.message : String(eventError));
        toast.error(`Shipment created but failed to add initial event: ${eventError instanceof Error ? eventError.message : 'Unknown error'}. Check console for details.`);
        // Don't continue if event failed
      }

      if (eventAdded) {
        toast.success(`Shipment ${data.trackingId} created successfully with initial event!`);
      } else {
        toast.warning(`Shipment ${data.trackingId} created but initial event failed. Please add event manually.`);
      }
      
      // Notify CargoTimeline to load the new shipment
      localStorage.setItem('newShipmentCreated', data.trackingId);
      // Trigger storage event for same-window communication
      window.dispatchEvent(new Event('storage'));
      
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to create shipment:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to create shipment: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Create Shipment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Create New Shipment
          </DialogTitle>
          <DialogDescription>
            Fill in the shipment details. Weight will be encrypted using FHE.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="trackingId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tracking ID</FormLabel>
                  <FormControl>
                    <Input placeholder="CARGO-2024-001" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin</FormLabel>
                    <FormControl>
                      <Input placeholder="Shanghai Port" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <FormControl>
                      <Input placeholder="Los Angeles Port" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (Encrypted)</FormLabel>
                    <FormControl>
                      <Input placeholder="2500" type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="estimatedDelivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Delivery</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contents</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Electronics, consumer goods, industrial parts..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting || isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isPending}>
                {isSubmitting || isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Shipment"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};


