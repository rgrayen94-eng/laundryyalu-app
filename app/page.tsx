"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { collection, addDoc, getDocs, query, where, orderBy } from "firebase/firestore";

type LoadPackage = {
  id: string;
  name: string;
  items: string;
  weight: string;
  idealFor: string;
  price: number;
};

type AddOn = {
  id: string;
  name: string;
  price: number;
};

type Booking = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  date: string;
  time: string;
  serviceType: string;
  loadPackage: string;
  addOns: string[];
  deliveryZone: string;
  notes: string;
  total: number;
  status: string;
};

const WHATSAPP_NUMBER = "94775727091";

const serviceTypes = [
  { id: "wash-fold", name: "Wash & Fold", note: "Daily laundry washed, dried, and folded." },
  { id: "iron-only", name: "Iron Only", note: "Office-ready crisp ironing." },
  { id: "dry-clean", name: "Dry Cleaning", note: "Premium care for delicate garments." },
];

const loadPackages: LoadPackage[] = [
  { id: "small", name: "Small Load", items: "5–10 pieces", weight: "Approx. 3kg", idealFor: "1 person / light weekly laundry", price: 890 },
  { id: "medium", name: "Medium Load", items: "10–20 pieces", weight: "Approx. 6kg", idealFor: "Couple / small family", price: 1590 },
  { id: "large", name: "Large Load", items: "20–35 pieces", weight: "Approx. 10kg", idealFor: "Family / heavy weekly laundry", price: 2490 },
];

const addOns: AddOn[] = [
  { id: "shirt", name: "Extra Shirt", price: 120 },
  { id: "trouser", name: "Extra Trouser", price: 180 },
  { id: "saree", name: "Saree Care", price: 650 },
  { id: "suit", name: "Suit / Blazer", price: 950 },
  { id: "blanket", name: "Blanket", price: 1200 },
  { id: "curtain", name: "Curtain Panel", price: 900 },
];

const deliveryZones = [
  { id: "near", name: "Near Zone", distance: "Within 3km", price: 250 },
  { id: "mid", name: "City Zone", distance: "3km – 7km", price: 450 },
  { id: "far", name: "Extended Zone", distance: "7km – 12km", price: 750 },
];

const subscriptionPlans = [
  { name: "Office Wear Weekly", price: 4500, details: "Weekly pickup, ironing, and delivery for busy professionals." },
  { name: "Family Laundry Plan", price: 9500, details: "Weekly washing and folding for families, apartments, and busy homes." },
  { name: "Premium Care Plan", price: 14500, details: "Dry cleaning, ironing, priority pickup, and premium garment handling." },
];

const statusSteps = ["Pickup Scheduled", "Picked Up", "Item Count Confirmed", "Cleaning", "Ironing", "Out for Delivery", "Delivered"];

function formatLKR(value: number) {
  return `Rs. ${value.toLocaleString("en-LK")}`;
}

export default function LaundryYaluApp() {
  const [activeTab, setActiveTab] = useState("book");
  const [selectedService, setSelectedService] = useState("wash-fold");
  const [selectedLoad, setSelectedLoad] = useState("medium");
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [selectedZone, setSelectedZone] = useState("mid");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("6:00 PM - 8:00 PM");
  const [notes, setNotes] = useState("");
  const [trackInput, setTrackInput] = useState("");
  const [trackedBooking, setTrackedBooking] = useState<Booking | null>(null);
  const [trackMessage, setTrackMessage] = useState("Enter your booking ID or phone number to track your order.");
  const [isTracking, setIsTracking] = useState(false);
  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);

  const isAdminMode = typeof window !== "undefined" && window.location.search.includes("admin=true");

  const service = serviceTypes.find((item) => item.id === selectedService)!;
  const load = loadPackages.find((item) => item.id === selectedLoad)!;
  const zone = deliveryZones.find((item) => item.id === selectedZone)!;

  const addOnTotal = useMemo(() => {
    return addOns.reduce((sum, item) => sum + (selectedAddOns[item.id] || 0) * item.price, 0);
  }, [selectedAddOns]);

  const selectedAddOnLabels = useMemo(() => {
    return addOns.filter((item) => selectedAddOns[item.id]).map((item) => `${item.name} x ${selectedAddOns[item.id]}`);
  }, [selectedAddOns]);

  const freeDeliveryDifference = Math.max(0, 3000 - (load.price + addOnTotal));
  const qualifiesFreeDelivery = load.price + addOnTotal >= 3000;
  const finalDeliveryFee = qualifiesFreeDelivery ? 0 : zone.price;
  const finalTotal = load.price + addOnTotal + finalDeliveryFee;

  function changeAddOn(id: string, amount: number) {
    setSelectedAddOns((current) => {
      const nextQty = Math.max(0, (current[id] || 0) + amount);
      return { ...current, [id]: nextQty };
    });
  }

  async function createBooking() {
    if (!customerName || !phone || !address || !pickupDate) {
      alert("Please fill customer name, phone, address, and pickup date.");
      return;
    }

    const bookingId = `LY-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBooking: Booking = {
      id: bookingId,
      customerName,
      phone,
      address,
      date: pickupDate,
      time: pickupTime,
      serviceType: service.name,
      loadPackage: load.name,
      addOns: selectedAddOnLabels,
      deliveryZone: zone.name,
      notes,
      total: finalTotal,
      status: "Pickup Scheduled",
    };

    await addDoc(collection(db, "bookings"), {
      ...newBooking,
      pickupDate,
      pickupTime,
      service: service.name,
      loadPackage: load.name,
      addons: selectedAddOnLabels,
      deliveryZone: zone.name,
      createdAt: new Date(),
    });

    setTrackedBooking(newBooking);
    setTrackInput(bookingId);
    setTrackMessage(`Booking created successfully. Your booking ID is ${bookingId}.`);
    setActiveTab("track");
  }

  async function trackBooking() {
    const searchValue = trackInput.trim();
    if (!searchValue) {
      setTrackMessage("Please enter your booking ID or phone number.");
      return;
    }

    setIsTracking(true);
    setTrackMessage("Searching for your booking...");

    try {
      const field = searchValue.toUpperCase().startsWith("LY-") ? "id" : "phone";
      const q = query(collection(db, "bookings"), where(field, "==", searchValue));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setTrackedBooking(null);
        setTrackMessage("No booking found. Please check your booking ID or phone number.");
        return;
      }

      const data = snapshot.docs[0].data() as Booking;
      setTrackedBooking({
        id: data.id,
        customerName: data.customerName,
        phone: data.phone,
        address: data.address,
        date: data.date || (data as any).pickupDate,
        time: data.time || (data as any).pickupTime,
        serviceType: data.serviceType || (data as any).service,
        loadPackage: data.loadPackage,
        addOns: data.addOns || (data as any).addons || [],
        deliveryZone: data.deliveryZone,
        notes: data.notes,
        total: data.total,
        status: data.status || "Pickup Scheduled",
      });
      setTrackMessage("Booking found.");
    } catch (error) {
      setTrackMessage("Something went wrong while tracking. Please try again.");
    } finally {
      setIsTracking(false);
    }
  }

  async function loadAdminBookings() {
    try {
      const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => doc.data() as Booking);
      setAdminBookings(data);
    } catch {
      const snapshot = await getDocs(collection(db, "bookings"));
      const data = snapshot.docs.map((doc) => doc.data() as Booking);
      setAdminBookings(data);
    }
  }

  useEffect(() => {
    if (isAdminMode) loadAdminBookings();
  }, [isAdminMode]);

  const currentStatusIndex = trackedBooking ? Math.max(0, statusSteps.indexOf(trackedBooking.status)) : 0;

  const whatsappMessage = encodeURIComponent(
    `Hello LaundryYalu, I want to book a laundry pickup.%0A%0A` +
      `Name: ${customerName || "Not added"}%0A` +
      `Phone: ${phone || "Not added"}%0A` +
      `Address: ${address || "Not added"}%0A` +
      `Pickup Date: ${pickupDate || "Not selected"}%0A` +
      `Pickup Time: ${pickupTime}%0A%0A` +
      `Service: ${service.name}%0A` +
      `Load: ${load.name} - ${load.items} - ${load.weight}%0A` +
      `Add-ons:%0A${selectedAddOnLabels.join("%0A") || "None"}%0A` +
      `Delivery Zone: ${zone.name} (${zone.distance})%0A%0A` +
      `Laundry Package: ${formatLKR(load.price)}%0A` +
      `Add-ons: ${formatLKR(addOnTotal)}%0A` +
      `Pickup Estimate: ${formatLKR(finalDeliveryFee)}%0A` +
      `Estimated Total: ${formatLKR(finalTotal)}%0A%0A` +
      `Notes: ${notes || "None"}`
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ecfdf5_0,#f8fafc_34%,#f4f0e8_100%)] text-slate-950">
      <div className="max-w-md mx-auto min-h-screen bg-[#fbfaf7] shadow-[0_30px_90px_rgba(15,23,42,0.22)] overflow-hidden border-x border-white/70">
        <header className="relative overflow-hidden bg-[linear-gradient(135deg,#06281f_0%,#0f766e_50%,#c49a45_135%)] text-white px-5 pt-8 pb-7 rounded-b-[42px] shadow-2xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-sm" />
          <div className="absolute left-5 bottom-0 h-px w-64 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
          <div className="absolute -left-20 top-24 h-44 w-44 rounded-full bg-emerald-300/15 blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.36em] uppercase text-emerald-100">ඔයාගේ Laundry යාලුවා</p>
                <h1 className="text-5xl font-black mt-2 tracking-tight">LaundryYalu</h1>
              </div>
              <div className="h-16 w-16 rounded-[1.5rem] bg-white/12 border border-white/20 shadow-xl backdrop-blur flex items-center justify-center text-3xl">✦</div>
            </div>
            <p className="text-emerald-50 mt-4 text-[15px] leading-relaxed max-w-sm">
              Premium laundry pickup with clear pricing, item-based add-ons, pickup estimates, and live order status.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/14 border border-white/20 px-3 py-1 text-xs font-bold backdrop-blur">Transparent Pricing</span>
              <span className="rounded-full bg-white/14 border border-white/20 px-3 py-1 text-xs font-bold backdrop-blur">Pickup + Delivery</span>
              <span className="rounded-full bg-white/14 border border-white/20 px-3 py-1 text-xs font-bold backdrop-blur">WhatsApp Support</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-6">
              <MiniStat label="Secure" value="ID" />
              <MiniStat label="Free Delivery" value="3K+" />
              <MiniStat label="Rating" value="4.9" />
            </div>
          </div>
        </header>

        {!isAdminMode && (
          <nav className="grid grid-cols-4 gap-2 px-4 mt-5">
            <TabButton label="Book" active={activeTab === "book"} onClick={() => setActiveTab("book")} />
            <TabButton label="Track" active={activeTab === "track"} onClick={() => setActiveTab("track")} />
            <TabButton label="Plans" active={activeTab === "plans"} onClick={() => setActiveTab("plans")} />
            <TabButton label="Support" active={activeTab === "support"} onClick={() => setActiveTab("support")} />
          </nav>
        )}

        <section className="p-4 pb-12">
          {isAdminMode && (
            <div className="space-y-5">
              <SectionTitle title="Admin Dashboard" subtitle="Hidden operator view. Customer app does not show this tab." />
              <button onClick={loadAdminBookings} className="w-full bg-emerald-700 text-white rounded-2xl py-3 font-black">Refresh Bookings</button>
              <div className="grid grid-cols-2 gap-3">
                <DashboardCard label="Bookings" value={adminBookings.length.toString()} />
                <DashboardCard label="Revenue" value={formatLKR(adminBookings.reduce((sum, b) => sum + (b.total || 0), 0))} />
              </div>
              <div className="space-y-3">
                {adminBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            </div>
          )}

          {!isAdminMode && activeTab === "book" && (
            <div className="space-y-5">
              <SectionTitle title="Book a Pickup" subtitle="Choose your service, load size, add-ons, and delivery zone to see a clearer price." />
              <div>
                <SmallHeading title="1. Select Service" />
                <div className="grid gap-3 mt-3">
                  {serviceTypes.map((item) => (
                    <button key={item.id} onClick={() => setSelectedService(item.id)} className={`text-left rounded-[1.5rem] p-4 border transition ${selectedService === item.id ? "bg-emerald-50 border-emerald-600 shadow-[0_16px_40px_rgba(4,120,87,0.13)]" : "bg-white/90 border-stone-200"}`}>
                      <p className="font-black text-lg">{item.name}</p>
                      <p className="text-sm text-slate-500 mt-1">{item.note}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <SmallHeading title="2. Choose Load Size" />
                <div className="space-y-3 mt-3">
                  {loadPackages.map((pkg) => {
                    const active = selectedLoad === pkg.id;
                    return (
                      <button key={pkg.id} onClick={() => setSelectedLoad(pkg.id)} className={`w-full text-left rounded-[1.75rem] p-4 border transition shadow-sm ${active ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-600 shadow-[0_16px_40px_rgba(4,120,87,0.13)]" : "bg-white/90 border-stone-200 hover:border-emerald-300 hover:shadow-md"}`}>
                        <div className="flex justify-between gap-3">
                          <div>
                            <h3 className="font-black text-lg tracking-tight">{pkg.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">{pkg.items} • {pkg.weight}</p>
                            <p className="text-xs text-slate-400 mt-1">{pkg.idealFor}</p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="font-black text-emerald-800">{formatLKR(pkg.price)}</p>
                            {active && <p className="text-xs font-black text-emerald-700 mt-1">Selected ✓</p>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <SmallHeading title="3. Add Special Items" />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {addOns.map((item) => (
                    <div key={item.id} className="bg-white/90 border border-stone-200 rounded-[1.5rem] p-3 shadow-sm">
                      <p className="font-black text-sm">{item.name}</p>
                      <p className="text-xs text-emerald-800 font-black mt-1">{formatLKR(item.price)}</p>
                      <div className="flex items-center justify-between mt-3">
                        <button onClick={() => changeAddOn(item.id, -1)} className="h-8 w-8 rounded-full bg-stone-100 font-black">−</button>
                        <span className="font-black">{selectedAddOns[item.id] || 0}</span>
                        <button onClick={() => changeAddOn(item.id, 1)} className="h-8 w-8 rounded-full bg-emerald-700 text-white font-black">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <SmallHeading title="4. Pickup Delivery Zone" />
                <div className="space-y-3 mt-3">
                  {deliveryZones.map((item) => (
                    <button key={item.id} onClick={() => setSelectedZone(item.id)} className={`w-full rounded-[1.5rem] p-4 border text-left ${selectedZone === item.id ? "bg-emerald-50 border-emerald-600" : "bg-white/90 border-stone-200"}`}>
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-black">{item.name}</p>
                          <p className="text-sm text-slate-500">{item.distance}</p>
                        </div>
                        <p className="font-black text-emerald-800">{formatLKR(item.price)}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">Delivery fee is estimated. Real cost can change slightly based on exact pickup/drop distance and availability.</p>
              </div>

              <div className="bg-white/90 rounded-[2rem] p-4 border border-stone-200 space-y-3 shadow-sm">
                <SmallHeading title="5. Customer Details" />
                <Input label="Customer Name" value={customerName} setValue={setCustomerName} placeholder="Example: Gishan" />
                <Input label="Phone Number" value={phone} setValue={setPhone} placeholder="Example: 0771234567" />
                <Input label="Pickup Address" value={address} setValue={setAddress} placeholder="Apartment / house / office address" />
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Pickup Date</span>
                  <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700" />
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Pickup Time</span>
                  <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700 bg-[#fffdf8]">
                    <option>8:00 AM - 10:00 AM</option>
                    <option>12:00 PM - 2:00 PM</option>
                    <option>4:00 PM - 6:00 PM</option>
                    <option>6:00 PM - 8:00 PM</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-black text-slate-700">Notes / Item Details</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Example: Please separate whites. 5 shirts, 2 trousers, 1 saree." className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 min-h-24 outline-none focus:ring-2 focus:ring-emerald-700" />
                </label>
              </div>

              <div className="relative overflow-hidden bg-[linear-gradient(135deg,#071913_0%,#0f2f26_70%,#7c5a18_140%)] text-white rounded-[2rem] p-5 shadow-2xl">
                <div className="relative z-10">
                  <p className="text-slate-300 text-sm">Clear Price Estimate</p>
                  <p className="text-4xl font-black mt-1 tracking-tight">{formatLKR(finalTotal)}</p>
                  <div className="mt-4 space-y-2 text-sm">
                    <PriceLine label={`${load.name} Package`} value={formatLKR(load.price)} />
                    <PriceLine label="Special Items" value={formatLKR(addOnTotal)} />
                    <PriceLine label={qualifiesFreeDelivery ? "Transport Estimate waived" : `${zone.name} Transport Estimate`} value={formatLKR(finalDeliveryFee)} />
                  </div>
                  {!qualifiesFreeDelivery && <p className="text-xs text-amber-100 mt-3">Add {formatLKR(freeDeliveryDifference)} more to qualify for free pickup/delivery offer.</p>}
                  <p className="text-xs text-slate-400 mt-3">Final amount is confirmed after pickup item count and actual transport rate.</p>
                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <button onClick={createBooking} className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl py-3 font-black shadow-lg">Save Booking</button>
                    <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`} target="_blank" rel="noreferrer">
                      <button className="w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 font-black shadow-lg">WhatsApp</button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isAdminMode && activeTab === "track" && (
            <div className="space-y-5">
              <SectionTitle title="Track Order" subtitle="Enter your booking ID or phone number to see your real order status." />
              <div className="bg-white/90 rounded-[2rem] p-4 border border-stone-200 shadow-sm space-y-3">
                <Input label="Booking ID or Phone Number" value={trackInput} setValue={setTrackInput} placeholder="Example: LY-2045 or 0771234567" />
                <button onClick={trackBooking} className="w-full bg-gradient-to-r from-emerald-700 to-teal-600 text-white rounded-2xl py-3 font-black shadow-lg">{isTracking ? "Searching..." : "Track Order"}</button>
                <p className="text-sm text-slate-500">{trackMessage}</p>
              </div>

              {trackedBooking && (
                <div className="bg-white/90 rounded-[2rem] p-5 border border-stone-200 shadow-sm">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-black uppercase tracking-[0.18em]">Booking</p>
                      <h2 className="text-3xl font-black mt-1 tracking-tight">{trackedBooking.id}</h2>
                      <p className="text-sm text-slate-500 mt-1">{trackedBooking.customerName} • {trackedBooking.address}</p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl text-xs font-black border border-emerald-100">{trackedBooking.status}</div>
                  </div>

                  <div className="mt-5 rounded-3xl bg-stone-50 border border-stone-200 p-4 text-sm">
                    <PriceLine label="Service" value={trackedBooking.serviceType} dark={false} />
                    <PriceLine label="Load" value={trackedBooking.loadPackage} dark={false} />
                    <PriceLine label="Delivery" value={trackedBooking.deliveryZone} dark={false} />
                    <PriceLine label="Total" value={formatLKR(trackedBooking.total)} dark={false} />
                  </div>

                  <div className="mt-6 space-y-4">
                    {statusSteps.map((step, index) => (
                      <div key={step} className="flex items-center gap-3">
                        <div className={`h-6 w-6 rounded-full border-4 ${index <= currentStatusIndex ? "bg-emerald-600 border-emerald-100" : "bg-stone-200 border-stone-100"}`} />
                        <p className={`font-bold ${index <= currentStatusIndex ? "text-slate-900" : "text-slate-400"}`}>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isAdminMode && activeTab === "plans" && (
            <div className="space-y-5">
              <SectionTitle title="Subscription Plans" subtitle="Recurring laundry care for office workers, families, and apartments." />
              {subscriptionPlans.map((plan, index) => (
                <div key={plan.name} className="relative overflow-hidden bg-[linear-gradient(135deg,#081b16_0%,#143b32_70%,#b8892e_150%)] text-white rounded-[2rem] p-5 shadow-2xl">
                  <div className="relative z-10">
                    <div className="flex justify-between items-start gap-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-amber-100">Monthly Plan</p>
                      {index === 0 && <span className="rounded-full bg-amber-200 text-amber-950 px-3 py-1 text-xs font-black">Popular</span>}
                    </div>
                    <h3 className="text-2xl font-black mt-2 tracking-tight">{plan.name}</h3>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">{plan.details}</p>
                    <p className="text-4xl font-black mt-5">{formatLKR(plan.price)}</p>
                    <button className="w-full mt-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 rounded-2xl py-3 font-black shadow-lg">Choose Plan</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isAdminMode && activeTab === "support" && (
            <div className="space-y-5">
              <SectionTitle title="Support" subtitle="Need help with pickup, pricing, or a current booking?" />
              <div className="bg-white/90 rounded-[2rem] p-5 border border-stone-200 shadow-sm">
                <h3 className="font-black text-xl">Talk to LaundryYalu</h3>
                <p className="text-sm text-slate-500 mt-2">For launch, WhatsApp support is the fastest and most familiar customer support channel in Sri Lanka.</p>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello LaundryYalu, I need support with my laundry booking.")}`} target="_blank" rel="noreferrer">
                  <button className="w-full mt-5 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 font-black shadow-lg">Open WhatsApp Support</button>
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="bg-white/90 border border-stone-200 rounded-[2rem] p-4 shadow-sm">
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-black text-lg">{booking.id}</p>
          <p className="text-sm text-slate-500">{booking.customerName} • {booking.phone}</p>
          <p className="text-sm text-slate-500">{booking.address}</p>
        </div>
        <p className="font-black text-emerald-800">{formatLKR(booking.total || 0)}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full font-black border border-emerald-100">{booking.serviceType || (booking as any).service}</span>
        <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-black border border-amber-100">{booking.loadPackage}</span>
        <span className="text-xs bg-slate-50 text-slate-700 px-3 py-1 rounded-full font-black border border-slate-100">{booking.status}</span>
      </div>
      <p className="text-xs text-slate-400 mt-2">Pickup: {booking.date || (booking as any).pickupDate} • {booking.time || (booking as any).pickupTime}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/12 rounded-2xl p-3 backdrop-blur border border-white/15 shadow-lg">
      <p className="text-xs text-emerald-100">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-2xl py-3 text-sm font-black transition ${active ? "bg-gradient-to-r from-emerald-800 to-teal-700 text-white shadow-lg" : "bg-white/80 text-slate-500 border border-stone-200"}`}>
      {label}
    </button>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-700">Premium Laundry Care</p>
      <h2 className="text-2xl font-black tracking-tight mt-1">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function SmallHeading({ title }: { title: string }) {
  return <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-700">{title}</h3>;
}

function Input({ label, value, setValue, placeholder }: { label: string; value: string; setValue: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700" />
    </label>
  );
}

function PriceLine({ label, value, dark = true }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className={dark ? "text-slate-300" : "text-slate-500"}>{label}</span>
      <span className={dark ? "font-black text-white text-right" : "font-black text-slate-900 text-right"}>{value}</span>
    </div>
  );
}

function DashboardCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/90 rounded-[1.75rem] p-4 border border-stone-200 shadow-sm">
      <p className="text-xs text-slate-500 font-black uppercase tracking-[0.12em]">{label}</p>
      <p className="text-xl font-black mt-1 text-slate-950">{value}</p>
    </div>
  );
}
