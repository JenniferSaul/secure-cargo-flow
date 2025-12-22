import { useState, useEffect, useCallback, useMemo } from "react";
import { Lock, LockOpen, MapPin, Package, Scale, AlertTriangle, Loader2, Search, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useAccount, usePublicClient } from "wagmi";
import { toast } from "sonner";
import { useSecureCargoFlow } from "@/hooks/useSecureCargoFlow";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface CargoEvent {
  eventId: string;
  timestamp: number;
  location: string;
  status: number;
  weight?: number; // Decrypted weight in kg
  contents?: string;
  anomaly?: string;
  isEncrypted: boolean;
}

interface ShipmentData {
  trackingId: string;
  origin: string;
  destination: string;
  createdAt: number;
  estimatedDelivery: number;
  creator: string;
  exists: boolean;
}

interface DecryptionResult {
  weight?: number;
  contents?: string;
}

const STATUS_NAMES = ["Created", "In Transit", "Customs Clearance", "Arrived", "Delivered"];

const eventSchema = z.object({
  location: z.string().min(2, "Location is required"),
  weight: z.string().optional(), // Optional, will be inherited from previous event
  status: z.string().min(1, "Status is required"),
  contents: z.string().min(3, "Contents description is required"),
});

type EventFormValues = z.infer<typeof eventSchema>;

// Shared Add Event Dialog Content Component
const AddEventDialogContent = ({
  trackingId,
  eventForm,
  isAddingEvent,
  setIsAddingEvent,
  setAddEventDialogOpen,
  addCargoEvent,
  loadShipmentData,
  getEventCount,
  isPending,
}: {
  trackingId: string;
  eventForm: ReturnType<typeof useForm<EventFormValues>>;
  isAddingEvent: boolean;
  setIsAddingEvent: (value: boolean) => void;
  setAddEventDialogOpen: (value: boolean) => void;
  addCargoEvent: (trackingId: string, location: string, status: number, weightInKg: number | null, contents: string) => Promise<string | undefined>;
  loadShipmentData: (id: string) => Promise<void>;
  getEventCount: (trackingId: string) => Promise<number>;
  isPending: boolean;
}) => {
  const { isConnected } = useAccount();
  const [eventCount, setEventCount] = useState<number>(0);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  // Load event count when dialog opens
  useEffect(() => {
    if (trackingId) {
      setIsLoadingCount(true);
      getEventCount(trackingId).then(count => {
        setEventCount(count);
        setIsLoadingCount(false);
      });
    }
  }, [trackingId, getEventCount]);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          Add Cargo Event
          {isLoadingCount && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </DialogTitle>
        <DialogDescription>
          {eventCount > 0 
            ? "Add a new event to track this shipment. Weight will be inherited from the previous event (cannot be changed)."
            : "Add a new event to track this shipment. Weight and contents will be encrypted using FHE."}
        </DialogDescription>
      </DialogHeader>
      <Form {...eventForm}>
        <form
          onSubmit={eventForm.handleSubmit(async (data) => {
            if (!isConnected) {
              toast.error("Please connect your wallet first");
              return;
            }
            if (!trackingId) {
              toast.error("No shipment selected");
              return;
            }

            setIsAddingEvent(true);
            try {
              // If there are previous events, weight is inherited (pass null)
              // Otherwise, use provided weight
              const weightValue = eventCount > 0 
                ? null 
                : (data.weight ? parseFloat(data.weight.replace(/[^0-9.]/g, "")) : null);

              if (weightValue === null && eventCount === 0) {
                toast.error("Weight is required for the first event");
                setIsAddingEvent(false);
                return;
              }

              if (weightValue !== null) {
                if (isNaN(weightValue) || weightValue <= 0) {
                  toast.error("Weight must be a positive number");
                  setIsAddingEvent(false);
                  return;
                }
                if (weightValue > 100000) {
                  toast.error("Weight cannot exceed 100,000 kg (100 tons)");
                  setIsAddingEvent(false);
                  return;
                }
                if (weightValue < 0.1) {
                  toast.error("Weight must be at least 0.1 kg");
                  setIsAddingEvent(false);
                  return;
                }
              }

              console.log("Manually adding cargo event:", {
                trackingId,
                location: data.location,
                status: parseInt(data.status),
                weight: weightValue || "inherited",
                contents: data.contents,
                eventCount,
              });

              await addCargoEvent(
                trackingId,
                data.location,
                parseInt(data.status),
                weightValue, // null if eventCount > 0
                data.contents
              );

              console.log("Cargo event added successfully, refreshing...");
              
              // Wait for transaction to be mined
              await new Promise((resolve) => setTimeout(resolve, 3000));
              
              // Reload shipment data
              await loadShipmentData(trackingId);
              
              toast.success("Event added successfully!");
              eventForm.reset();
              setAddEventDialogOpen(false);
            } catch (error) {
              console.error("Failed to add cargo event:", error);
              const errorMessage = error instanceof Error ? error.message : "Unknown error";
              console.error("Error details:", errorMessage);
              toast.error(`Failed to add event: ${errorMessage}`);
            } finally {
              setIsAddingEvent(false);
            }
          })}
          className="space-y-4"
        >
          <FormField
            control={eventForm.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="Shanghai Port, China" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={eventForm.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (kg, encrypted)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={eventCount > 0 ? "Inherited from previous event" : "2500"} 
                      type="number" 
                      {...field}
                      disabled={eventCount > 0 || isLoadingCount}
                      value={eventCount > 0 ? "Inherited" : field.value}
                    />
                  </FormControl>
                  {eventCount > 0 && (
                    <p className="text-xs text-muted-foreground">Weight cannot be changed after first event</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={eventForm.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="0">Created</option>
                      <option value="1">In Transit</option>
                      <option value="2">Customs Clearance</option>
                      <option value="3">Arrived</option>
                      <option value="4">Delivered</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={eventForm.control}
            name="contents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contents</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Electronic Components (Class A)"
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
              onClick={() => setAddEventDialogOpen(false)}
              disabled={isAddingEvent}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isAddingEvent || isPending}>
              {isAddingEvent || isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Event"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
};

export const CargoTimeline = () => {
  const [trackingId, setTrackingId] = useState<string>("");
  const [searchTrackingId, setSearchTrackingId] = useState<string>("");
  const [cargoEvents, setCargoEvents] = useState<CargoEvent[]>([]);
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [isLoadingShipment, setIsLoadingShipment] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [addEventDialogOpen, setAddEventDialogOpen] = useState(false);
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { getShipment, loadCargoEvents, addCargoEvent, getEventCount, isPending } = useSecureCargoFlow();

  const eventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      location: "",
      weight: "",
      status: "0",
      contents: "",
    },
  });

  const loadShipmentData = useCallback(async (id: string) => {
    if (!id.trim()) {
      setCargoEvents([]);
      setShipment(null);
      return;
    }

    setIsLoadingShipment(true);
    try {
      console.log("Loading shipment:", id);
      const shipmentData = await getShipment(id);
      console.log("Shipment data:", shipmentData);
      
      if (shipmentData && shipmentData.exists) {
        setShipment(shipmentData);
        // Load events
        console.log("Loading cargo events...");
        const events = await loadCargoEvents(id);
        console.log("Loaded events:", events);
        console.log("Event count:", events.length);
        setCargoEvents(events);
        
        if (events.length === 0) {
          console.warn("No events found for shipment:", id);
          toast.info("Shipment found but no events yet. Events may still be processing.");
        }
      } else {
        setShipment(null);
        setCargoEvents([]);
        toast.error("Shipment not found");
      }
    } catch (error) {
      console.error("Load shipment failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to load shipment: ${errorMessage}`);
      setShipment(null);
      setCargoEvents([]);
    } finally {
      setIsLoadingShipment(false);
    }
  }, [getShipment, loadCargoEvents]);

  // Load shipment and events when trackingId changes
  useEffect(() => {
    if (trackingId && publicClient) {
      loadShipmentData(trackingId);
    }
  }, [trackingId, publicClient, loadShipmentData]);

  // Listen for new shipment created (via localStorage)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'newShipmentCreated' && e.newValue) {
        const newTrackingId = e.newValue;
        setSearchTrackingId(newTrackingId);
        setTrackingId(newTrackingId);
        loadShipmentData(newTrackingId);
        localStorage.removeItem('newShipmentCreated');
      }
    };

    // Check for existing new shipment
    const newShipmentId = localStorage.getItem('newShipmentCreated');
    if (newShipmentId) {
      setSearchTrackingId(newShipmentId);
      setTrackingId(newShipmentId);
      loadShipmentData(newShipmentId);
      localStorage.removeItem('newShipmentCreated');
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [publicClient, loadShipmentData]);

  const handleSearch = useCallback(() => {
    if (searchTrackingId.trim()) {
      const trimmedId = searchTrackingId.trim();
      setTrackingId(trimmedId);
      loadShipmentData(trimmedId);
    } else {
      toast.error("Please enter a tracking ID");
    }
  }, [searchTrackingId, loadShipmentData]);

  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }, []);

  // Listen for transaction completion to refresh data
  useEffect(() => {
    if (isPending === false && trackingId) {
      // Refresh data when transaction completes
      const timer = setTimeout(() => {
        loadShipmentData(trackingId);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isPending, trackingId, loadShipmentData]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Search Section */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Search Shipment</h2>
        </div>
        <div className="flex gap-3">
          <Input
            placeholder="Enter Tracking ID (e.g., CARGO-2024-001)"
            value={searchTrackingId}
            onChange={(e) => setSearchTrackingId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isLoadingShipment || !searchTrackingId.trim()}>
            {isLoadingShipment ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading shipment data...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Shipment
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Shipment Details */}
      {shipment ? (
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Cargo #{shipment.trackingId}</h2>
            <p className="text-muted-foreground">
              {shipment.origin} → {shipment.destination}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Created: {formatTimestamp(Number(shipment.createdAt))}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 rounded-lg">
              <Package className="h-5 w-5 text-success" />
              <span className="text-success font-medium">Active Shipment</span>
            </div>
            <Dialog open={addEventDialogOpen} onOpenChange={setAddEventDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!isConnected || isPending}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Event
                </Button>
              </DialogTrigger>
              <AddEventDialogContent
                trackingId={trackingId}
                eventForm={eventForm}
                isAddingEvent={isAddingEvent}
                setIsAddingEvent={setIsAddingEvent}
                setAddEventDialogOpen={setAddEventDialogOpen}
                addCargoEvent={addCargoEvent}
                loadShipmentData={loadShipmentData}
                getEventCount={getEventCount}
                isPending={isPending}
              />
            </Dialog>
          </div>
        </div>
      ) : trackingId ? (
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shipment...</p>
        </Card>
      ) : null}

      {!trackingId ? (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">Enter a tracking ID to view shipment details</p>
          <p className="text-sm text-muted-foreground">Or create a new shipment to get started</p>
        </Card>
      ) : !shipment ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Shipment not found. Please check the tracking ID.</p>
        </Card>
      ) : cargoEvents.length === 0 ? (
        <Card className="p-8 text-center space-y-4">
          <p className="text-muted-foreground">No cargo events found for this shipment.</p>
          <Dialog open={addEventDialogOpen} onOpenChange={setAddEventDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!isConnected || isAddingEvent}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Event
              </Button>
            </DialogTrigger>
            <AddEventDialogContent
              trackingId={trackingId}
              eventForm={eventForm}
              isAddingEvent={isAddingEvent}
              setIsAddingEvent={setIsAddingEvent}
              setAddEventDialogOpen={setAddEventDialogOpen}
              addCargoEvent={addCargoEvent}
              loadShipmentData={loadShipmentData}
              getEventCount={getEventCount}
              isPending={isPending}
            />
          </Dialog>
        </Card>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

          {cargoEvents.map((event, index) => {
            return (
              <div key={event.eventId} className="relative pl-16 pb-8 last:pb-0">
                {/* Timeline dot */}
                <div className="absolute left-4 top-6 w-5 h-5 rounded-full bg-primary border-4 border-background shadow-md" />

                <Card className="p-4 md:p-6 hover:shadow-lg transition-all duration-300 w-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin className="h-5 w-5 text-accent" />
                        <h3 className="text-lg font-semibold text-foreground">{event.location}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{formatTimestamp(event.timestamp)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-foreground">Status:</span>
                      <span className="px-3 py-1 bg-primary/10 text-primary rounded-full">
                        {STATUS_NAMES[event.status] || "Unknown"}
                      </span>
                    </div>

                    {/* Description/Contents */}
                    {event.contents && (
                      <div className="flex items-start gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <span className="font-medium text-foreground">Description: </span>
                          <span className="text-muted-foreground">{event.contents}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {!isConnected && (
        <Card className="p-6 bg-muted/50 border-muted">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Connect your wallet to add cargo events
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};


