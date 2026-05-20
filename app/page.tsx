"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

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
  docId?: string;
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
  paymentStatus?: string;
  actualItemCount?: number;
  actualWeight?: number;
  finalBill?: number;
  adminNotes?: string;
  createdAt?: unknown;
  pickupDate?: string;
  pickupTime?: string;
  service?: string;
  addons?: string[];
};

const ADMIN_EMAIL = "rgrayen94@gmail.com";
const WHATSAPP_NUMBER = "94775727091";

const serviceTypes = [
  {
    id: "wash-fold",
    name: "Wash & Fold",
    note: "Daily laundry washed, dried, and folded.",
  },
  {
    id: "iron-only",
    name: "Iron Only",
    note: "Office-ready crisp ironing.",
  },
  {
    id: "dry-clean",
    name: "Dry Cleaning",
    note: "Premium care for delicate garments.",
  },
];

const loadPackages: LoadPackage[] = [
  {
    id: "small",
    name: "Small Load",
    items: "5–10 pieces",
    weight: "Approx. 3kg",
    idealFor: "1 person / light weekly laundry",
    price: 890,
  },
  {
    id: "medium",
    name: "Medium Load",
    items: "10–20 pieces",
    weight: "Approx. 6kg",
    idealFor: "Couple / small family",
    price: 1590,
  },
  {
    id: "large",
    name: "Large Load",
    items: "20–35 pieces",
    weight: "Approx. 10kg",
    idealFor: "Family / heavy weekly laundry",
    price: 2490,
  },
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
  {
    name: "Office Wear Weekly",
    price: 4500,
    details: "Weekly pickup, ironing, and delivery for busy professionals.",
  },
  {
    name: "Family Laundry Plan",
    price: 9500,
    details: "Weekly washing and folding for families, apartments, and busy homes.",
  },
  {
    name: "Premium Care Plan",
    price: 14500,
    details: "Dry cleaning, ironing, priority pickup, and premium garment handling.",
  },
];

const statusSteps = [
  "Pickup Scheduled",
  "Picked Up",
  "Item Count Confirmed",
  "Cleaning",
  "Ironing",
  "Out for Delivery",
  "Delivered",
];

function formatLKR(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString("en-LK")}`;
}

export default function LaundryYaluApp() {
  const [activeTab, setActiveTab] = useState("book");
  const [bookingStep, setBookingStep] = useState(1);

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
  const [trackMessage, setTrackMessage] = useState(
    "Enter your booking ID or phone number to track your order."
  );
  const [isTracking, setIsTracking] = useState(false);

  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [adminEmail, setAdminEmail] = useState(ADMIN_EMAIL);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState("");
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);

  const [adminBookings, setAdminBookings] = useState<Booking[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("All");
  const [selectedAdminBooking, setSelectedAdminBooking] = useState<Booking | null>(null);
  const [adminStatus, setAdminStatus] = useState("Pickup Scheduled");
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [actualItemCount, setActualItemCount] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [finalBill, setFinalBill] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const service = serviceTypes.find((item) => item.id === selectedService) || serviceTypes[0];
  const load = loadPackages.find((item) => item.id === selectedLoad) || loadPackages[1];
  const zone = deliveryZones.find((item) => item.id === selectedZone) || deliveryZones[1];

  const addOnTotal = useMemo(() => {
    return addOns.reduce((sum, item) => sum + (selectedAddOns[item.id] || 0) * item.price, 0);
  }, [selectedAddOns]);

  const selectedAddOnLabels = useMemo(() => {
    return addOns
      .filter((item) => selectedAddOns[item.id])
      .map((item) => `${item.name} x ${selectedAddOns[item.id]}`);
  }, [selectedAddOns]);

  const qualifiesFreeDelivery = load.price + addOnTotal >= 3000;
  const finalDeliveryFee = qualifiesFreeDelivery ? 0 : zone.price;
  const finalTotal = load.price + addOnTotal + finalDeliveryFee;

  const currentStatusIndex = trackedBooking
    ? Math.max(0, statusSteps.indexOf(trackedBooking.status))
    : 0;

  const filteredAdminBookings = useMemo(() => {
    const search = adminSearch.trim().toLowerCase();

    return adminBookings.filter((booking) => {
      const matchesSearch =
        !search ||
        `${booking.id} ${booking.customerName} ${booking.phone} ${booking.address}`
          .toLowerCase()
          .includes(search);

      const matchesStatus = adminStatusFilter === "All" || booking.status === adminStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [adminBookings, adminSearch, adminStatusFilter]);

  useEffect(() => {
    const adminMode = window.location.search.includes("admin=true");
    setIsAdminMode(adminMode);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user?.email === ADMIN_EMAIL ? user : null);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAdminMode && adminUser) {
      loadAdminBookings();
    }
  }, [isAdminMode, adminUser]);

  function changeAddOn(id: string, amount: number) {
    setSelectedAddOns((current) => {
      const nextQty = Math.max(0, (current[id] || 0) + amount);
      return { ...current, [id]: nextQty };
    });
  }

  async function loginAdmin() {
    setAdminLoginError("");

    if (adminEmail.trim().toLowerCase() !== ADMIN_EMAIL) {
      setAdminLoginError("This email is not allowed for admin access.");
      return;
    }

    if (!adminPassword) {
      setAdminLoginError("Please enter your admin password.");
      return;
    }

    try {
      setIsAdminLoggingIn(true);
      await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      setAdminPassword("");
    } catch (error) {
      console.error(error);
      setAdminLoginError("Admin login failed. Please check the email and password.");
    } finally {
      setIsAdminLoggingIn(false);
    }
  }

  async function logoutAdmin() {
    await signOut(auth);
    setSelectedAdminBooking(null);
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
      paymentStatus: "Pending",
      finalBill: finalTotal,
    };

    try {
      await addDoc(collection(db, "bookings"), {
        ...newBooking,
        pickupDate,
        pickupTime,
        service: service.name,
        addons: selectedAddOnLabels,
        createdAt: new Date(),
      });

      setTrackedBooking(newBooking);
      setTrackInput(bookingId);
      setTrackMessage(
        `Booking confirmed. Your booking ID is ${bookingId}. We will confirm pickup via WhatsApp shortly.`
      );
      setActiveTab("track");
      setBookingStep(1);
    } catch (error) {
      console.error(error);
      alert("Booking could not be saved. Please try again or contact us on WhatsApp.");
    }
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
        date: data.date || data.pickupDate || "",
        time: data.time || data.pickupTime || "",
        serviceType: data.serviceType || data.service || "",
        loadPackage: data.loadPackage || "",
        addOns: data.addOns || data.addons || [],
        deliveryZone: data.deliveryZone || "",
        notes: data.notes || "",
        total: data.total || 0,
        finalBill: data.finalBill,
        status: data.status || "Pickup Scheduled",
        paymentStatus: data.paymentStatus || "Pending",
        actualItemCount: data.actualItemCount,
        actualWeight: data.actualWeight,
        adminNotes: data.adminNotes,
      });

      setTrackMessage("Booking found.");
    } catch (error) {
      console.error(error);
      setTrackMessage("Something went wrong while tracking. Please try again.");
    } finally {
      setIsTracking(false);
    }
  }

  async function loadAdminBookings() {
    try {
      const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({
        docId: docSnap.id,
        ...(docSnap.data() as Booking),
      }));
      setAdminBookings(data);
    } catch (error) {
      console.error(error);
      const snapshot = await getDocs(collection(db, "bookings"));
      const data = snapshot.docs.map((docSnap) => ({
        docId: docSnap.id,
        ...(docSnap.data() as Booking),
      }));
      setAdminBookings(data);
    }
  }

  function openAdminBooking(booking: Booking) {
    setSelectedAdminBooking(booking);
    setAdminStatus(booking.status || "Pickup Scheduled");
    setPaymentStatus(booking.paymentStatus || "Pending");
    setActualItemCount(booking.actualItemCount?.toString() || "");
    setActualWeight(booking.actualWeight?.toString() || "");
    setFinalBill((booking.finalBill || booking.total || 0).toString());
    setAdminNotes(booking.adminNotes || "");
  }

  async function saveAdminUpdates() {
    if (!selectedAdminBooking?.docId) {
      alert("No booking selected.");
      return;
    }

    try {
      const bookingRef = doc(db, "bookings", selectedAdminBooking.docId);

      await updateDoc(bookingRef, {
        status: adminStatus,
        paymentStatus,
        actualItemCount: Number(actualItemCount || 0),
        actualWeight: Number(actualWeight || 0),
        finalBill: Number(finalBill || 0),
        adminNotes,
        updatedAt: new Date(),
      });

      alert("Booking updated successfully.");
      setSelectedAdminBooking(null);
      await loadAdminBookings();
    } catch (error) {
      console.error(error);
      alert("Failed to update booking.");
    }
  }

  const whatsappMessage = encodeURIComponent("Hi LaundryYalu 👋 I need help with a laundry pickup.");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ecfdf5_0,#f8fafc_36%,#f4f0e8_100%)] text-slate-950">
      <div className="max-w-md mx-auto min-h-screen bg-[#fbfaf7] shadow-[0_30px_90px_rgba(15,23,42,0.22)] overflow-hidden border-x border-white/70">
        <HeroHeader />

        {!isAdminMode && (
          <nav className="grid grid-cols-4 gap-2 px-4 mt-5">
            <TabButton label="Book" active={activeTab === "book"} onClick={() => setActiveTab("book")} />
            <TabButton label="Track" active={activeTab === "track"} onClick={() => setActiveTab("track")} />
            <TabButton label="Plans" active={activeTab === "plans"} onClick={() => setActiveTab("plans")} />
            <TabButton label="Support" active={activeTab === "support"} onClick={() => setActiveTab("support")} />
          </nav>
        )}

        <section className="p-4 pb-12">
          {isAdminMode && !adminUser && (
            <div className="space-y-5">
              <SectionTitle
                title="Admin Login"
                subtitle="Sign in with the approved admin email to manage LaundryYalu bookings."
              />

              <div className="bg-white/90 rounded-[2rem] p-5 border border-stone-200 shadow-sm space-y-4">
                <Input label="Admin Email" value={adminEmail} setValue={setAdminEmail} placeholder="Admin email" />

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Admin Password</span>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter Firebase Auth password"
                    className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </label>

                {adminLoginError && <p className="text-sm font-bold text-red-600">{adminLoginError}</p>}

                <button
                  onClick={loginAdmin}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] transition text-white rounded-2xl py-3 font-black shadow-lg"
                >
                  {isAdminLoggingIn ? "Signing in..." : "Sign In to Admin Dashboard"}
                </button>

                <p className="text-xs text-slate-500">
                  Admin updates are protected by Firebase Authentication.
                </p>
              </div>
            </div>
          )}

          {isAdminMode && adminUser && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle
                  title="Admin Dashboard"
                  subtitle="Operator view for bookings, updates, billing, and status management."
                />

                <button onClick={logoutAdmin} className="text-xs bg-stone-100 px-3 py-2 rounded-full font-black">
                  Sign Out
                </button>
              </div>

              <button
                onClick={async () => {
                  await loadAdminBookings();
                  alert("Bookings refreshed.");
                }}
                className="w-full bg-emerald-700 text-white rounded-2xl py-3 font-black"
              >
                Refresh Bookings
              </button>

              <div className="grid grid-cols-2 gap-3">
                <DashboardCard label="Bookings" value={adminBookings.length.toString()} />
                <DashboardCard
                  label="Revenue"
                  value={formatLKR(adminBookings.reduce((sum, b) => sum + (b.finalBill || b.total || 0), 0))}
                />
              </div>

              <div className="bg-white/90 rounded-[2rem] p-4 border border-stone-200 space-y-3 shadow-sm">
                <Input
                  label="Search Bookings"
                  value={adminSearch}
                  setValue={setAdminSearch}
                  placeholder="Booking ID, phone, name, area"
                />

                <label className="block">
                  <span className="text-sm font-black text-slate-700">Filter by Status</span>
                  <select
                    value={adminStatusFilter}
                    onChange={(e) => setAdminStatusFilter(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    <option>All</option>
                    {statusSteps.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-3">
                {filteredAdminBookings.length === 0 && (
                  <div className="bg-white/90 border border-stone-200 rounded-[2rem] p-5 text-sm text-slate-500">
                    No bookings match your search/filter.
                  </div>
                )}

                {filteredAdminBookings.map((booking) => (
                  <button
                    key={booking.docId || booking.id}
                    onClick={() => openAdminBooking(booking)}
                    className="w-full text-left"
                  >
                    <BookingCard booking={booking} />
                  </button>
                ))}
              </div>

              {selectedAdminBooking && (
                <div className="bg-white border-2 border-emerald-500 rounded-3xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 font-black">
                        Manage Booking
                      </p>
                      <h2 className="text-2xl font-black">{selectedAdminBooking.id}</h2>
                    </div>

                    <button
                      onClick={() => setSelectedAdminBooking(null)}
                      className="bg-stone-100 rounded-full px-3 py-2 text-xs font-black"
                    >
                      Close
                    </button>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-4 text-sm space-y-1">
                    <p><strong>Customer:</strong> {selectedAdminBooking.customerName}</p>
                    <p><strong>Phone:</strong> {selectedAdminBooking.phone}</p>
                    <p><strong>Address:</strong> {selectedAdminBooking.address}</p>
                    <p>
                      <strong>Pickup:</strong> {selectedAdminBooking.date || selectedAdminBooking.pickupDate} •{" "}
                      {selectedAdminBooking.time || selectedAdminBooking.pickupTime}
                    </p>
                  </div>

                  <label className="block">
                    <span className="text-sm font-black text-slate-700">Status</span>
                    <select
                      value={adminStatus}
                      onChange={(e) => setAdminStatus(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      {statusSteps.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-black text-slate-700">Payment Status</span>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      <option>Pending</option>
                      <option>Paid</option>
                      <option>Partially Paid</option>
                    </select>
                  </label>

                  <Input label="Actual Item Count" value={actualItemCount} setValue={setActualItemCount} placeholder="Example: 18" />
                  <Input label="Actual Weight" value={actualWeight} setValue={setActualWeight} placeholder="Example: 6.5" />
                  <Input label="Final Bill" value={finalBill} setValue={setFinalBill} placeholder="Example: 2500" />

                  <label className="block">
                    <span className="text-sm font-black text-slate-700">Operator Notes</span>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Example: Customer added 2 extra shirts."
                      className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 min-h-24 outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </label>

                  <button onClick={saveAdminUpdates} className="w-full bg-emerald-700 text-white rounded-2xl py-3 font-black">
                    Save Updates
                  </button>
                </div>
              )}
            </div>
          )}

          {!isAdminMode && activeTab === "book" && (
            <div className="space-y-5">
              <IntroFeatureSection />
              <StepProgress step={bookingStep} />

              {bookingStep === 1 && (
                <div>
                  <SmallHeading title="1. Select Service" />

                  <div className="grid gap-3 mt-3">
                    {serviceTypes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedService(item.id)}
                        className={`text-left rounded-[1.65rem] p-4 border transition active:scale-[0.99] ${
                          selectedService === item.id
                            ? "bg-emerald-50 border-emerald-600 shadow-[0_18px_45px_rgba(4,120,87,0.12)]"
                            : "bg-white/90 border-stone-200 hover:border-emerald-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <ServiceIcon id={item.id} />
                          <div>
                            <p className="font-black text-lg">{item.name}</p>
                            <p className="text-sm text-slate-500 mt-1">{item.note}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <StepButtons onNext={() => setBookingStep(2)} />
                </div>
              )}

              {bookingStep === 2 && (
                <div>
                  <SmallHeading title="2. Choose Load Size" />

                  <div className="space-y-3 mt-3">
                    {loadPackages.map((pkg) => {
                      const active = selectedLoad === pkg.id;

                      return (
                        <button
                          key={pkg.id}
                          onClick={() => setSelectedLoad(pkg.id)}
                          className={`w-full text-left rounded-[1.75rem] p-4 border transition shadow-sm active:scale-[0.99] ${
                            active
                              ? "bg-gradient-to-br from-emerald-50 to-white border-emerald-600 shadow-[0_16px_40px_rgba(4,120,87,0.13)]"
                              : "bg-white/90 border-stone-200 hover:border-emerald-300 hover:shadow-md"
                          }`}
                        >
                          <div className="flex justify-between gap-3">
                            <div>
                              <h3 className="font-black text-lg tracking-tight">{pkg.name}</h3>
                              <p className="text-sm text-slate-500 mt-1">
                                {pkg.items} • {pkg.weight}
                              </p>
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

                  <StepButtons onBack={() => setBookingStep(1)} onNext={() => setBookingStep(3)} />
                </div>
              )}

              {bookingStep === 3 && (
                <div>
                  <SmallHeading title="3. Add Extra Items, If Any" />
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Your selected load already covers normal clothes. Add these only for extra or bulky items
                    like shirts, trousers, sarees, suits, blankets, or curtains.
                  </p>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {addOns.map((item) => (
                      <div key={item.id} className="bg-white/90 border border-stone-200 rounded-[1.5rem] p-3 shadow-sm">
                        <div className="flex items-start gap-2">
                          <AddOnIcon id={item.id} />
                          <div>
                            <p className="font-black text-sm leading-tight">{item.name}</p>
                            <p className="text-xs text-emerald-800 font-black mt-1">{formatLKR(item.price)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <button onClick={() => changeAddOn(item.id, -1)} className="h-8 w-8 rounded-full bg-stone-100 font-black">−</button>
                          <span className="font-black">{selectedAddOns[item.id] || 0}</span>
                          <button onClick={() => changeAddOn(item.id, 1)} className="h-8 w-8 rounded-full bg-emerald-700 text-white font-black">+</button>
                        </div>

                        {(selectedAddOns[item.id] || 0) > 0 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Subtotal: {formatLKR((selectedAddOns[item.id] || 0) * item.price)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5">
                    <button onClick={() => setBookingStep(2)} className="bg-stone-100 text-slate-700 rounded-2xl py-4 font-black text-lg shadow-sm">
                      Back
                    </button>
                    <button onClick={() => setBookingStep(4)} className="bg-emerald-700 text-white rounded-2xl py-4 font-black text-sm shadow-lg active:scale-[0.98] transition">
                      {addOnTotal > 0 ? "Continue" : "No Extra Items — Continue"}
                    </button>
                  </div>
                </div>
              )}

              {bookingStep === 4 && (
                <div>
                  <SmallHeading title="4. Pickup Delivery Zone" />

                  <div className="space-y-3 mt-3">
                    {deliveryZones.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedZone(item.id)}
                        className={`w-full rounded-[1.5rem] p-4 border text-left active:scale-[0.99] transition ${
                          selectedZone === item.id ? "bg-emerald-50 border-emerald-600" : "bg-white/90 border-stone-200"
                        }`}
                      >
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

                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Delivery fee is estimated based on your selected pickup/delivery zone.
                  </p>

                  <StepButtons onBack={() => setBookingStep(3)} onNext={() => setBookingStep(5)} />
                </div>
              )}

              {bookingStep === 5 && (
                <div className="space-y-5">
                  <div className="bg-white/90 rounded-[2rem] p-4 border border-stone-200 space-y-3 shadow-sm">
                    <SmallHeading title="5. Customer Details" />
                    <Input label="Customer Name" value={customerName} setValue={setCustomerName} placeholder="Example: Gishan" />
                    <Input label="Phone Number" value={phone} setValue={setPhone} placeholder="Example: 0771234567" />
                    <Input label="Pickup Address" value={address} setValue={setAddress} placeholder="Apartment / house / office address" />

                    <label className="block">
                      <span className="text-sm font-black text-slate-700">Pickup Date</span>
                      <input
                        type="date"
                        value={pickupDate}
                        onChange={(e) => setPickupDate(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-black text-slate-700">Pickup Time</span>
                      <select
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        className="mt-1 w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700 bg-[#fffdf8]"
                      >
                        <option>8:00 AM - 10:00 AM</option>
                        <option>12:00 PM - 2:00 PM</option>
                        <option>4:00 PM - 6:00 PM</option>
                        <option>6:00 PM - 8:00 PM</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-sm font-black text-slate-700">Notes / Item Details</span>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Example: Please separate whites. 5 shirts, 2 trousers, 1 saree."
                        className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 min-h-24 outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                    </label>
                  </div>

                  <div className="relative overflow-hidden bg-[linear-gradient(135deg,#071913_0%,#0f2f26_70%,#7c5a18_140%)] text-white rounded-[2rem] p-5 shadow-2xl">
                    <div className="relative z-10">
                      <p className="text-slate-300 text-sm">Clear Price Estimate</p>
                      <p className="text-4xl font-black mt-1 tracking-tight">{formatLKR(finalTotal)}</p>

                      <div className="mt-4 space-y-2 text-sm">
                        <PriceLine label={`${load.name} Package`} value={formatLKR(load.price)} />
                        <PriceLine label="Extra Items" value={formatLKR(addOnTotal)} />
                        <PriceLine
                          label={qualifiesFreeDelivery ? "Transport Estimate waived" : `${zone.name} Transport Estimate`}
                          value={formatLKR(finalDeliveryFee)}
                        />
                      </div>

                      <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-100 font-black">Payment Method</p>
                        <p className="text-sm font-bold mt-1">Cash on delivery or bank transfer after confirmation.</p>
                        <p className="text-xs text-slate-300 mt-1">No online payment is required to place the booking.</p>
                      </div>

                      {!qualifiesFreeDelivery && (
                        <p className="text-xs text-amber-100 mt-3">Free pickup & delivery available for larger orders.</p>
                      )}

                      <p className="text-xs text-slate-400 mt-3">
                        Pricing remains transparent. Adjustments apply only if the actual load size or delivery zone differs from the original booking.
                      </p>

                      <div className="grid grid-cols-2 gap-3 mt-5">
                        <button
                          onClick={createBooking}
                          className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl py-3 font-black shadow-lg active:scale-[0.98] transition"
                        >
                          Save Booking
                        </button>

                        <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`} target="_blank" rel="noreferrer">
                          <button className="w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 font-black shadow-lg active:scale-[0.98] transition">
                            Chat on WhatsApp
                          </button>
                        </a>
                      </div>
                    </div>
                  </div>

                  <StepButtons onBack={() => setBookingStep(4)} />
                </div>
              )}
            </div>
          )}

          {!isAdminMode && activeTab === "track" && (
            <div className="space-y-5">
              <SectionTitle title="Track Order" subtitle="Enter your booking ID or phone number to see your real order status." />

              <div className="bg-white/90 rounded-[2rem] p-4 border border-stone-200 shadow-sm space-y-3">
                <Input label="Booking ID or Phone Number" value={trackInput} setValue={setTrackInput} placeholder="Example: LY-2045 or 0771234567" />
                <button onClick={trackBooking} className="w-full bg-gradient-to-r from-emerald-700 to-teal-600 text-white rounded-2xl py-3 font-black shadow-lg">
                  {isTracking ? "Searching..." : "Track Order"}
                </button>
                <p className="text-sm text-slate-500">{trackMessage}</p>
              </div>

              {trackedBooking && (
                <div className="bg-white/90 rounded-[2rem] p-5 border border-stone-200 shadow-sm">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-xs text-slate-500 font-black uppercase tracking-[0.18em]">Booking</p>
                      <h2 className="text-3xl font-black mt-1 tracking-tight">{trackedBooking.id}</h2>
                      <p className="text-sm text-slate-500 mt-1">
                        {trackedBooking.customerName} • {trackedBooking.address}
                      </p>
                    </div>

                    <div className="bg-emerald-50 text-emerald-800 px-3 py-2 rounded-xl text-xs font-black border border-emerald-100">
                      {trackedBooking.status}
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl bg-stone-50 border border-stone-200 p-4 text-sm">
                    <PriceLine label="Service" value={trackedBooking.serviceType} dark={false} />
                    <PriceLine label="Load" value={trackedBooking.loadPackage} dark={false} />
                    <PriceLine label="Delivery" value={trackedBooking.deliveryZone} dark={false} />
                    <PriceLine label="Total" value={formatLKR(trackedBooking.finalBill || trackedBooking.total)} dark={false} />
                    <PriceLine label="Payment" value={trackedBooking.paymentStatus || "Pending"} dark={false} />
                  </div>

                  <div className="mt-6 space-y-4">
                    {statusSteps.map((step, index) => (
                      <div key={step} className="flex items-center gap-3">
                        <div
                          className={`h-6 w-6 rounded-full border-4 ${
                            index <= currentStatusIndex ? "bg-emerald-600 border-emerald-100" : "bg-stone-200 border-stone-100"
                          }`}
                        />
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
                <div
                  key={plan.name}
                  className="relative overflow-hidden bg-[linear-gradient(135deg,#081b16_0%,#143b32_70%,#b8892e_150%)] text-white rounded-[2rem] p-5 shadow-2xl"
                >
                  <div className="relative z-10">
                    <div className="flex justify-between items-start gap-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-amber-100">Monthly Plan</p>
                      {index === 0 && <span className="rounded-full bg-amber-200 text-amber-950 px-3 py-1 text-xs font-black">Popular</span>}
                    </div>

                    <h3 className="text-2xl font-black mt-2 tracking-tight">{plan.name}</h3>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">{plan.details}</p>
                    <p className="text-4xl font-black mt-5">{formatLKR(plan.price)}</p>

                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi LaundryYalu 👋 I am interested in the ${plan.name} plan.`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <button className="w-full mt-5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 rounded-2xl py-3 font-black shadow-lg">
                        Choose Plan
                      </button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isAdminMode && activeTab === "support" && (
            <div className="space-y-5">
              <SectionTitle title="Support" subtitle="Need help with pickup, pricing, or a current booking?" />

              <HowItWorks />

              <div className="bg-white/90 rounded-[2rem] p-5 border border-stone-200 shadow-sm">
                <h3 className="font-black text-xl">Talk to LaundryYalu</h3>
                <p className="text-sm text-slate-500 mt-2">
                  For launch, WhatsApp support is the fastest and most familiar customer support channel in Sri Lanka.
                </p>

                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi LaundryYalu 👋 I need support with my laundry booking.")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <button className="w-full mt-5 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 font-black shadow-lg">
                    Open WhatsApp Support
                  </button>
                </a>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function HeroHeader() {
  return (
    <header className="relative overflow-hidden bg-[linear-gradient(135deg,#06281f_0%,#0f766e_50%,#c49a45_135%)] text-white px-5 pt-8 pb-7 rounded-b-[42px] shadow-2xl">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-sm animate-pulse" />
      <div className="absolute left-5 bottom-0 h-px w-64 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
      <div className="absolute -left-20 top-24 h-44 w-44 rounded-full bg-emerald-300/15 blur-2xl animate-pulse" />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-[0.36em] uppercase text-emerald-100">
              ඔයාගේ Laundry යාලුවා
            </p>
            <h1 className="text-5xl font-black mt-2 tracking-tight">LaundryYalu</h1>
          </div>

          <div className="h-16 w-16 rounded-[1.5rem] bg-white/12 border border-white/20 shadow-xl backdrop-blur flex items-center justify-center text-3xl animate-pulse">
            ✦
          </div>
        </div>

        <p className="text-emerald-50 mt-4 text-[15px] leading-relaxed max-w-sm">
          Premium laundry pickup with clear pricing, item-based add-ons, pickup estimates,
          and live order status.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/14 border border-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            Transparent Pricing
          </span>
          <span className="rounded-full bg-white/14 border border-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            Pickup + Delivery
          </span>
          <span className="rounded-full bg-white/14 border border-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
            WhatsApp Support
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-6">
          <MiniStat label="Secure" value="ID" />
          <MiniStat label="Free Delivery" value="3K+" />
          <MiniStat label="Rating" value="4.9" />
        </div>
      </div>
    </header>
  );
}

function IntroFeatureSection() {
  return (
    <div className="relative overflow-hidden rounded-[2.4rem] bg-white border border-white shadow-[0_28px_80px_rgba(15,23,42,0.12)] p-5">
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-100 blur-3xl" />
      <div className="absolute -left-16 bottom-12 h-40 w-40 rounded-full bg-amber-100/70 blur-3xl" />

      <div className="relative z-10">
        <p className="text-slate-400 font-black text-lg">Hi there! 👋</p>

        <h2 className="text-[2.45rem] leading-[1.02] font-black tracking-[-0.05em] mt-2 text-slate-950">
          Fresh clothes,
          <br />
          zero hassle.
        </h2>

        <div className="mt-6 -mx-5 overflow-x-auto px-5 pb-4">
          <div className="flex gap-4 w-max">
            <FeatureCard
              variant="pay"
              title="Pay after confirmation"
              body="No upfront payment. Pay only when your pickup is confirmed."
            />
            <FeatureCard
              variant="chat"
              title="Friendly WhatsApp support"
              body="Real person. Real help. We are here for your laundry questions."
            />
            <FeatureCard
              variant="live"
              title="Live order status"
              body="Track pickup, washing, ironing, and delivery step by step."
            />
          </div>
        </div>

        <div className="mt-4 relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#064e3b_0%,#0f766e_58%,#0f3d35_100%)] text-white p-5 shadow-2xl">
          <div className="absolute -right-10 -bottom-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute right-5 top-5 h-16 w-16 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
            <span className="text-2xl">→</span>
          </div>

          <div className="relative z-10 max-w-[15rem]">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-100">
              Premium Laundry Care
            </p>

            <h3 className="text-3xl font-black mt-2 tracking-[-0.03em]">
              Book a Pickup
            </h3>

            <p className="text-sm text-emerald-50/90 leading-relaxed mt-3">
              Choose your service, load size, add-ons, and delivery zone to see a clear price.
            </p>
          </div>

          <div className="absolute right-5 bottom-3 text-white/80">
            <LaundryBasketIcon />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  body,
  variant,
}: {
  title: string;
  body: string;
  variant: "pay" | "chat" | "live";
}) {
  const isPay = variant === "pay";
  const isChat = variant === "chat";
  const isLive = variant === "live";

  const cardStyle = isPay
    ? "from-emerald-50 via-white to-white border-emerald-100 text-emerald-700"
    : isChat
      ? "from-lime-50 via-white to-white border-lime-100 text-green-600"
      : "from-orange-50 via-white to-white border-orange-100 text-orange-500";

  const iconCircle = isPay
    ? "bg-gradient-to-br from-emerald-500 to-teal-500"
    : isChat
      ? "bg-gradient-to-br from-green-500 to-lime-400"
      : "bg-gradient-to-br from-orange-400 to-amber-500";

  const arrowCircle = isPay
    ? "bg-gradient-to-br from-teal-500 to-emerald-600"
    : isChat
      ? "bg-gradient-to-br from-lime-300 to-lime-500 text-slate-950"
      : "bg-gradient-to-br from-orange-400 to-orange-500";

  return (
    <div
      className={`relative w-[15.8rem] min-h-[16.5rem] shrink-0 rounded-[2rem] border bg-gradient-to-br ${cardStyle} p-5 shadow-[0_22px_55px_rgba(15,23,42,0.10)] overflow-hidden active:scale-[0.985] transition`}
    >
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/80 blur-2xl" />
      <div className="absolute left-4 top-4 h-24 w-24 rounded-full bg-white/55 blur-xl" />

      {isLive && (
        <div className="absolute right-4 top-4 rounded-full bg-orange-100 text-orange-600 px-3 py-1 text-[10px] font-black">
          LIVE
        </div>
      )}

      <div className="relative z-10">
        <div className="relative h-20 w-20 rounded-[1.7rem] bg-white/80 border border-white shadow-[0_18px_38px_rgba(15,23,42,0.10)] flex items-center justify-center">
          <div className={`h-12 w-12 rounded-2xl ${iconCircle} text-white flex items-center justify-center shadow-lg`}>
            {isPay && <CardIcon />}
            {isChat && <ChatIcon />}
            {isLive && <PinIcon />}
          </div>
        </div>

        <h3 className="text-[1.25rem] leading-[1.08] font-black tracking-[-0.03em] text-slate-950 mt-7">
          {title}
        </h3>

        <p className="text-sm leading-relaxed text-slate-500 mt-3">
          {body}
        </p>

        <div className={`absolute right-0 bottom-0 h-11 w-11 rounded-full ${arrowCircle} text-white flex items-center justify-center text-xl font-black shadow-xl`}>
          →
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    "Book your pickup",
    "We confirm by WhatsApp",
    "Items are counted before processing",
    "Status is updated until delivery",
  ];

  return (
    <div className="bg-white/90 border border-stone-200 rounded-[2rem] p-5 shadow-sm">
      <h3 className="font-black text-xl text-slate-950">How LaundryYalu Works</h3>

      <div className="grid gap-3 mt-4">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3 text-sm">
            <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-black text-xs">
              {index + 1}
            </div>
            <p className="font-bold text-slate-700">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ServiceIcon({ id }: { id: string }) {
  const icon =
    id === "wash-fold" ? <LaundryBasketIcon small /> : id === "iron-only" ? <ShirtIcon /> : <SparkleIcon />;

  return (
    <span className="h-12 w-12 min-w-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-amber-50 border border-stone-200 flex items-center justify-center text-emerald-700 shadow-sm">
      {icon}
    </span>
  );
}

function AddOnIcon({ id }: { id: string }) {
  const icons: Record<string, string> = {
    shirt: "👕",
    trouser: "👖",
    saree: "🧣",
    suit: "🤵",
    blanket: "▰",
    curtain: "▥",
  };

  return (
    <span className="h-9 w-9 min-w-9 rounded-2xl bg-gradient-to-br from-stone-50 to-emerald-50 border border-stone-200 flex items-center justify-center text-lg shadow-sm">
      {icons[id] || "＋"}
    </span>
  );
}

function StepProgress({ step }: { step: number }) {
  return (
    <div className="bg-white/90 border border-stone-200 rounded-3xl p-3 shadow-sm">
      <div className="flex justify-between text-xs font-black text-slate-500 mb-2">
        <span>Step {step} of 5</span>
        <span>{Math.round((step / 5) * 100)}%</span>
      </div>

      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-700 to-teal-500 rounded-full transition-all"
          style={{ width: `${(step / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}

function StepButtons({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  return (
    <div className={`grid gap-3 mt-5 ${onBack && onNext ? "grid-cols-2" : "grid-cols-1"}`}>
      {onBack && (
        <button onClick={onBack} className="bg-stone-100 text-slate-700 rounded-2xl py-4 font-black text-lg shadow-sm">
          Back
        </button>
      )}

      {onNext && (
        <button
          onClick={onNext}
          className="bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] transition text-white rounded-2xl py-4 font-black text-lg shadow-lg"
        >
          Continue
        </button>
      )}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="bg-white/90 border border-stone-200 rounded-[2rem] p-4 shadow-sm">
      <div className="flex justify-between gap-3">
        <div>
          <p className="font-black text-lg">{booking.id}</p>
          <p className="text-sm text-slate-500">
            {booking.customerName} • {booking.phone}
          </p>
          <p className="text-sm text-slate-500">{booking.address}</p>
        </div>

        <p className="font-black text-emerald-800">{formatLKR(booking.finalBill || booking.total || 0)}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full font-black border border-emerald-100">
          {booking.serviceType || booking.service}
        </span>
        <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-black border border-amber-100">
          {booking.loadPackage}
        </span>
        <span className="text-xs bg-slate-50 text-slate-700 px-3 py-1 rounded-full font-black border border-slate-100">
          {booking.status}
        </span>
      </div>

      <p className="text-xs text-slate-400 mt-2">
        Pickup: {booking.date || booking.pickupDate} • {booking.time || booking.pickupTime}
      </p>
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
    <button
      onClick={onClick}
      className={`rounded-2xl py-3 text-sm font-black transition ${
        active
          ? "bg-gradient-to-r from-emerald-800 to-teal-700 text-white shadow-lg"
          : "bg-white/80 text-slate-500 border border-stone-200"
      }`}
    >
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

function Input({
  label,
  value,
  setValue,
  placeholder,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-stone-200 bg-[#fffdf8] px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-700"
      />
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

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="7" width="16" height="10" rx="2" />
      <path d="M4 10h16M7 15h4" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21 11.5a8.5 8.5 0 01-12.4 7.6L4 20l.9-4.5A8.5 8.5 0 1121 11.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 12h.01M12 12h.01M15 12h.01" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M12 21s7-4.4 7-11a7 7 0 10-14 0c0 6.6 7 11 7 11z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function LaundryBasketIcon({ small = false }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={small ? "h-6 w-6" : "h-12 w-12"} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 9h14l-1.2 10H6.2L5 9z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9l3-5 3 5M8 13h8M9 16h6" strokeLinecap="round" />
    </svg>
  );
}

function ShirtIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 4l4 2 4-2 4 4-3 3v9H7v-9L4 8l4-4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9L18 16z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
