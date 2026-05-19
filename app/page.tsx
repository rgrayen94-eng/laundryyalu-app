"use client";

import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { auth, db } from "./firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";

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
};

const WHATSAPP_NUMBER = "94775727091";

const ADMIN_EMAIL = "rgrayen94@gmail.com";

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

  const service = serviceTypes.find((item) => item.id === selectedService)!;
  const load = loadPackages.find((item) => item.id === selectedLoad)!;
  const zone = deliveryZones.find((item) => item.id === selectedZone)!;

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
      if (user?.email === ADMIN_EMAIL) {
        setAdminUser(user);
      } else {
        setAdminUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAdminMode && adminUser) {
      loadAdminBookings();
    }
  }, [isAdminMode, adminUser]);

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
      setTrackMessage(`Booking confirmed. Your booking ID is ${bookingId}. We will confirm pickup via WhatsApp shortly.`);
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

      const data = snapshot.docs[0].data() as Booking & {
        pickupDate?: string;
        pickupTime?: string;
        service?: string;
        addons?: string[];
      };

      setTrackedBooking({
        id: data.id,
        customerName: data.customerName,
        phone: data.phone,
        address: data.address,
        date: data.date || data.pickupDate || "",
        time: data.time || data.pickupTime || "",
        serviceType: data.serviceType || data.service || "",
        loadPackage: data.loadPackage,
        addOns: data.addOns || data.addons || [],
        deliveryZone: data.deliveryZone,
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

  const whatsappMessage = encodeURIComponent(
    `Hi LaundryYalu 👋 I need help with a laundry pickup.`
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ecfdf5_0,#f8fafc_34%,#f4f0e8_100%)] text-slate-950">
      <style jsx global>{`
        @keyframes floatGlow {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.65; }
          50% { transform: translateY(-18px) scale(1.08); opacity: 0.95; }
        }

        @keyframes shimmerText {
          0% { background-position: -220% center; }
          100% { background-position: 220% center; }
        }

        @keyframes softRise {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 14px 32px rgba(4, 120, 87, 0.22); transform: translateY(0); }
          50% { box-shadow: 0 20px 46px rgba(4, 120, 87, 0.38); transform: translateY(-1px); }
        }

        @keyframes progressGlow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
        }

        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(16, 185, 129, 0); }
          50% { box-shadow: 0 12px 26px rgba(16, 185, 129, 0.16); }
        }

        .ly-float-glow { animation: floatGlow 5.2s ease-in-out infinite; }
        .ly-rise { animation: softRise 520ms ease-out both; }
        .ly-rise-delay-1 { animation: softRise 620ms ease-out both; animation-delay: 90ms; }
        .ly-rise-delay-2 { animation: softRise 720ms ease-out both; animation-delay: 160ms; }
        .ly-pulse { animation: pulseGlow 2.8s ease-in-out infinite; }
        .ly-progress { animation: progressGlow 2.4s ease-in-out infinite; }
        .{ animation: badgeGlow 3.2s ease-in-out infinite; }

        .ly-shimmer {
          background: linear-gradient(90deg, #ffffff 0%, #d1fae5 28%, #f8e7b0 50%, #ffffff 72%, #ffffff 100%);
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmerText 4.5s linear infinite;
        }


        @keyframes neonSweep {
          0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
          18% { opacity: 0.55; }
          50% { opacity: 0.95; }
          100% { transform: translateX(155%) skewX(-18deg); opacity: 0; }
        }

        @keyframes emeraldBreath {
          0%, 100% {
            box-shadow:
              0 0 0 rgba(16, 185, 129, 0),
              inset 0 0 0 rgba(255, 255, 255, 0);
            transform: translateY(0) scale(1);
          }
          50% {
            box-shadow:
              0 16px 36px rgba(16, 185, 129, 0.24),
              inset 0 1px 0 rgba(255, 255, 255, 0.55);
            transform: translateY(-2px) scale(1.015);
          }
        }

        @keyframes checkPop {
          0%, 100% { transform: scale(1) rotate(0deg); }
          35% { transform: scale(1.22) rotate(-8deg); }
          65% { transform: scale(1.05) rotate(4deg); }
        }

        @keyframes buttonShine {
          0% { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
          25% { opacity: 0.65; }
          55% { opacity: 1; }
          100% { transform: translateX(145%) skewX(-18deg); opacity: 0; }
        }

        @keyframes buttonHeartbeat {
          0%, 100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 18px 38px rgba(4, 120, 87, 0.30);
          }
          45% {
            transform: translateY(-2px) scale(1.018);
            box-shadow: 0 24px 55px rgba(4, 120, 87, 0.46);
          }
        }

        @keyframes tapRipple {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 0.75; }
          100% { transform: translate(-50%, -50%) scale(3.2); opacity: 0; }
        }

        .{
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(236,253,245,0.96), rgba(209,250,229,0.82)),
            radial-gradient(circle at 20% 10%, rgba(255,255,255,0.98), transparent 36%);
          border: 1px solid rgba(16, 185, 129, 0.24);
          animation: emeraldBreath 3.4s ease-in-out infinite;
          isolation: isolate;
        }

        .ly-premium-chip::before {
          content: "";
          position: absolute;
          inset: -45%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent);
          animation: neonSweep 3.8s ease-in-out infinite;
          z-index: -1;
        }

        .ly-premium-chip::after {
          content: "";
          position: absolute;
          inset: 1px;
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.6);
          pointer-events: none;
        }

        .ly-check {
          display: inline-flex;
          width: 1.2rem;
          height: 1.2rem;
          border-radius: 999px;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #047857, #10b981);
          color: white;
          font-size: 0.75rem;
          margin-right: 0.35rem;
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35);
          animation: checkPop 2.7s ease-in-out infinite;
        }

        .ly-action-button {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transform: translateZ(0);
          transition:
            transform 140ms ease,
            filter 140ms ease,
            box-shadow 140ms ease;
          animation: buttonHeartbeat 2.7s ease-in-out infinite;
        }

        .ly-action-button::before {
          content: "";
          position: absolute;
          top: -40%;
          left: -25%;
          width: 40%;
          height: 180%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.42), transparent);
          animation: buttonShine 2.9s ease-in-out infinite;
          z-index: -1;
        }

        .ly-action-button::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 90px;
          height: 90px;
          border-radius: 999px;
          background: rgba(255,255,255,0.22);
          transform: translate(-50%, -50%) scale(0);
          opacity: 0;
          pointer-events: none;
        }

        .ly-action-button:hover {
          filter: brightness(1.06) saturate(1.08);
          transform: translateY(-3px) scale(1.01);
        }

        .ly-action-button:active {
          transform: translateY(1px) scale(0.975);
          filter: brightness(0.96);
        }

        .ly-action-button:active::after {
          animation: tapRipple 520ms ease-out;
        }

        .ly-action-button span {
          position: relative;
          z-index: 1;
        }


        @keyframes staggerIn {
          from {
            opacity: 0;
            transform: translateY(14px);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes elegantBorder {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes softShine {
          0% { transform: translateX(-140%) skewX(-16deg); opacity: 0; }
          30% { opacity: 0.55; }
          70% { opacity: 0.75; }
          100% { transform: translateX(145%) skewX(-16deg); opacity: 0; }
        }

        .ly-stagger {
          opacity: 0;
          animation: staggerIn 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .ly-modern-card {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(#ffffff, #ffffff) padding-box,
            linear-gradient(135deg, rgba(15, 118, 110, 0.35), rgba(180, 83, 9, 0.28), rgba(30, 41, 59, 0.24)) border-box;
          border: 1px solid transparent;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
        }

        .ly-modern-card::after {
          content: "";
          position: absolute;
          top: -40%;
          left: -35%;
          width: 34%;
          height: 180%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent);
          animation: softShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .ly-step-number {
          background: linear-gradient(135deg, #0f766e, #0f172a);
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(15, 118, 110, 0.26);
        }

        .{
          position: relative;
          overflow: hidden;
          min-height: 4.8rem;
          border: 1px solid rgba(148, 163, 184, 0.22);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
          background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.88));
        }

        .ly-premium-chip-v2::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--chip-glow);
          opacity: 0.92;
          pointer-events: none;
        }

        .ly-premium-chip-v2::after {
          content: "";
          position: absolute;
          top: -40%;
          left: -50%;
          width: 36%;
          height: 180%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.78), transparent);
          animation: softShine 4.8s ease-in-out infinite;
          animation-delay: var(--shine-delay);
          pointer-events: none;
        }

        . {
          position: relative;
          z-index: 1;
          display: inline-flex;
          width: 2rem;
          height: 2rem;
          min-width: 2rem;
          border-radius: 999px;
          align-items: center;
          justify-content: center;
          color: white;
          background: var(--chip-icon);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
        }

        . {
          position: relative;
          z-index: 1;
        }


        @keyframes timelineReveal {
          0% {
            opacity: 0;
            transform: translateX(-18px);
            filter: blur(5px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
            filter: blur(0);
          }
        }

        @keyframes luxuryCardReveal {
          0% {
            opacity: 0;
            transform: translateY(16px);
            filter: blur(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes fineShine {
          0% { transform: translateX(-140%) skewX(-14deg); opacity: 0; }
          30% { opacity: 0.45; }
          68% { opacity: 0.6; }
          100% { transform: translateX(150%) skewX(-14deg); opacity: 0; }
        }

        @keyframes ringGlow {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(180, 83, 9, 0.0),
              0 10px 22px rgba(15, 23, 42, 0.08);
          }
          50% {
            box-shadow:
              0 0 0 7px rgba(180, 83, 9, 0.055),
              0 16px 34px rgba(15, 23, 42, 0.12);
          }
        }

        .ly-lux-panel {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at 12% 0%, rgba(250, 204, 21, 0.10), transparent 28%),
            radial-gradient(circle at 92% 18%, rgba(20, 184, 166, 0.10), transparent 34%),
            linear-gradient(135deg, rgba(255,255,255,0.98), rgba(250,250,247,0.94));
          border: 1px solid rgba(148, 163, 184, 0.20);
          box-shadow:
            0 22px 55px rgba(15, 23, 42, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.9);
        }

        .ly-lux-panel::after {
          content: "";
          position: absolute;
          top: -55%;
          left: -40%;
          width: 30%;
          height: 210%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent);
          animation: fineShine 6.2s ease-in-out infinite;
          pointer-events: none;
        }

        .ly-timeline-item {
          opacity: 0;
          animation: timelineReveal 620ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .ly-soft-number {
          position: relative;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.92), rgba(236,253,245,0.92));
          color: #0f766e;
          border: 1px solid rgba(15, 118, 110, 0.16);
          box-shadow:
            0 10px 22px rgba(15, 118, 110, 0.10),
            inset 0 1px 0 rgba(255,255,255,0.95);
        }

        .ly-soft-number::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 999px;
          border: 1px solid rgba(180, 83, 9, 0.10);
          opacity: 0.85;
        }

        .ly-lux-badge {
          position: relative;
          overflow: hidden;
          min-height: 5.35rem;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.96), rgba(250,250,247,0.94)) padding-box,
            linear-gradient(135deg, rgba(15,118,110,0.22), rgba(180,83,9,0.20), rgba(15,23,42,0.12)) border-box;
          border: 1px solid transparent;
          box-shadow:
            0 18px 44px rgba(15, 23, 42, 0.075),
            inset 0 1px 0 rgba(255,255,255,0.92);
          opacity: 0;
          animation: luxuryCardReveal 680ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .ly-lux-badge::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--lux-glow);
          opacity: 0.72;
          pointer-events: none;
        }

        .ly-lux-badge::after {
          content: "";
          position: absolute;
          top: -55%;
          left: -45%;
          width: 32%;
          height: 210%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent);
          animation: fineShine 5.8s ease-in-out infinite;
          animation-delay: var(--shine-delay);
          pointer-events: none;
        }

        .ly-lux-icon {
          position: relative;
          z-index: 1;
          display: inline-flex;
          width: 2.25rem;
          height: 2.25rem;
          min-width: 2.25rem;
          border-radius: 1rem;
          align-items: center;
          justify-content: center;
          background: var(--lux-icon-bg);
          color: var(--lux-icon-color);
          border: 1px solid rgba(255,255,255,0.78);
          animation: ringGlow 4.8s ease-in-out infinite;
        }

        .ly-lux-icon svg {
          width: 1.05rem;
          height: 1.05rem;
          stroke-width: 2.3;
        }

        .ly-lux-text {
          position: relative;
          z-index: 1;
          letter-spacing: -0.01em;
        }


        @keyframes timelineLoop {
          0% {
            opacity: 0.45;
            transform: translateX(-6px);
            filter: blur(1.8px);
          }
          10% {
            opacity: 1;
            transform: translateX(0);
            filter: blur(0);
          }
          28% {
            opacity: 1;
            transform: translateX(0);
            filter: blur(0);
          }
          42% {
            opacity: 0.58;
            transform: translateX(0);
            filter: blur(0);
          }
          100% {
            opacity: 0.45;
            transform: translateX(-6px);
            filter: blur(1.8px);
          }
        }

        @keyframes numberLoopGlow {
          0%, 100% {
            background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(236,253,245,0.92));
            color: #0f766e;
            transform: scale(1);
            box-shadow:
              0 10px 22px rgba(15, 118, 110, 0.10),
              inset 0 1px 0 rgba(255,255,255,0.95);
          }
          12%, 28% {
            background: linear-gradient(135deg, #0f766e, #14b8a6);
            color: white;
            transform: scale(1.045);
            box-shadow:
              0 16px 34px rgba(15, 118, 110, 0.25),
              0 0 0 8px rgba(20, 184, 166, 0.08),
              inset 0 1px 0 rgba(255,255,255,0.35);
          }
        }

        @keyframes panelBreath {
          0%, 100% {
            box-shadow:
              0 22px 55px rgba(15, 23, 42, 0.08),
              inset 0 1px 0 rgba(255,255,255,0.9);
          }
          50% {
            box-shadow:
              0 28px 70px rgba(15, 118, 110, 0.11),
              inset 0 1px 0 rgba(255,255,255,0.96);
          }
        }

        .ly-lux-panel {
          animation: panelBreath 9s ease-in-out infinite;
        }

        .ly-timeline-item {
          opacity: 0.45;
          animation: timelineLoop 12s ease-in-out infinite;
          animation-delay: var(--loop-delay);
        }

        .ly-soft-number {
          animation: numberLoopGlow 12s ease-in-out infinite;
          animation-delay: var(--loop-delay);
        }

        .ly-card-hover {
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .ly-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
        }

        .ly-card-hover:active {
          transform: scale(0.985);
        }
      `}</style>
      <div className="max-w-md mx-auto min-h-screen bg-[#fbfaf7] shadow-[0_30px_90px_rgba(15,23,42,0.22)] overflow-hidden border-x border-white/70">
        <header className="relative overflow-hidden bg-[linear-gradient(135deg,#06281f_0%,#0f766e_50%,#c49a45_135%)] text-white px-5 pt-8 pb-7 rounded-b-[42px] shadow-2xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-sm ly-float-glow" />
          <div className="absolute left-5 bottom-0 h-px w-64 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
          <div className="absolute -left-20 top-24 h-44 w-44 rounded-full bg-emerald-300/15 blur-2xl ly-float-glow" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.36em] uppercase text-emerald-100">ඔයාගේ Laundry යාලුවා</p>
                <h1 className="text-5xl font-black mt-2 tracking-tight ly-shimmer">LaundryYalu</h1>
              </div>

              <div className="h-16 w-16 rounded-[1.5rem] bg-white/12 border border-white/20 shadow-xl backdrop-blur flex items-center justify-center text-3xl ly-float-glow">
                ✦
              </div>
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
          {isAdminMode && !adminUser && (
            <div className="space-y-5">
              <SectionTitle title="Admin Login" subtitle="Sign in with the approved admin email to manage LaundryYalu bookings." />

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

                <button onClick={loginAdmin} className="w-full ly-action-button bg-emerald-700 text-white rounded-2xl py-3 font-black">
                  <span>{isAdminLoggingIn ? "Signing in..." : "Sign In to Admin Dashboard"}</span>
                </button>

                <p className="text-xs text-slate-500">
                  Admin updates are protected by Firebase Authentication. Only the approved admin email should be allowed in Firestore rules.
                </p>
              </div>
            </div>
          )}

{isAdminMode && adminUser && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle title="Admin Dashboard" subtitle="Operator view for bookings, updates, billing, and status management." />

                <button onClick={logoutAdmin} className="text-xs bg-stone-100 px-3 py-2 rounded-full font-black">
                  Sign Out
                </button>
              </div>

              <button
                onClick={async () => {
                  await loadAdminBookings();
                  alert("Bookings refreshed.");
                }}
                className="w-full ly-pulse bg-emerald-700 text-white rounded-2xl py-3 font-black"
              >
                Refresh Bookings
              </button>

              <div className="grid grid-cols-2 gap-3">
                <DashboardCard label="Bookings" value={adminBookings.length.toString()} />
                <DashboardCard label="Revenue" value={formatLKR(adminBookings.reduce((sum, b) => sum + (b.finalBill || b.total || 0), 0))} />
              </div>

              <div className="bg-white/90 rounded-[2rem] p-4 border border-stone-200 space-y-3 shadow-sm">
                <Input label="Search Bookings" value={adminSearch} setValue={setAdminSearch} placeholder="Booking ID, phone, name, area" />

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
                  <div className="ly-rise bg-white/90 border border-stone-200 rounded-[2rem] p-5 text-sm text-slate-500">
                    No bookings match your search/filter.
                  </div>
                )}

                {filteredAdminBookings.map((booking) => (
                  <button key={booking.docId || booking.id} onClick={() => openAdminBooking(booking)} className="w-full text-left">
                    <BookingCard booking={booking} />
                  </button>
                ))}
              </div>

              {selectedAdminBooking && (
                <div className="bg-white border-2 border-emerald-500 rounded-3xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 font-black">Manage Booking</p>
                      <h2 className="text-2xl font-black">{selectedAdminBooking.id}</h2>
                    </div>

                    <button onClick={() => setSelectedAdminBooking(null)} className="bg-stone-100 rounded-full px-3 py-2 text-xs font-black">
                      Close
                    </button>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-4 text-sm space-y-1">
                    <p><strong>Customer:</strong> {selectedAdminBooking.customerName}</p>
                    <p><strong>Phone:</strong> {selectedAdminBooking.phone}</p>
                    <p><strong>Address:</strong> {selectedAdminBooking.address}</p>
                    <p><strong>Pickup:</strong> {selectedAdminBooking.date || (selectedAdminBooking as any).pickupDate} • {selectedAdminBooking.time || (selectedAdminBooking as any).pickupTime}</p>
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

                  <button onClick={saveAdminUpdates} className="w-full ly-pulse bg-emerald-700 text-white rounded-2xl py-3 font-black">
                    Save Updates
                  </button>
                </div>
              )}
            </div>
          )}

          {!isAdminMode && activeTab === "book" && (
            <div className="space-y-5">
              <SectionTitle title="Book a Pickup" subtitle="Start with your service and get a clear estimate before booking." />

              <QuickTrustStrip />
              <StepProgress step={bookingStep} />

              {bookingStep === 1 && (
                <div>
                  <SmallHeading title="1. Select Service" />

                  <div className="grid gap-3 mt-3">
                    {serviceTypes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedService(item.id)}
                        className={`ly-card-hover text-left rounded-[1.5rem] p-4 border transition ${
                          selectedService === item.id
                            ? "bg-emerald-50 border-emerald-600 shadow-[0_16px_40px_rgba(4,120,87,0.13)]"
                            : "bg-white/90 border-stone-200"
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
                          className={`ly-card-hover w-full text-left rounded-[1.75rem] p-4 border transition shadow-sm ${
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
                    Your selected load already covers normal clothes. Add these only for extra or bulky items like shirts, trousers, sarees, suits, blankets, or curtains.
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
                          <button onClick={() => changeAddOn(item.id, -1)} className="h-8 w-8 rounded-full bg-stone-100 font-black">
                            −
                          </button>
                          <span className="font-black">{selectedAddOns[item.id] || 0}</span>
                          <button onClick={() => changeAddOn(item.id, 1)} className="h-8 w-8 rounded-full bg-emerald-700 text-white font-black">
                            +
                          </button>
                        </div>

                        {(selectedAddOns[item.id] || 0) > 0 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Subtotal: {formatLKR((selectedAddOns[item.id] || 0) * item.price)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <StepButtons onBack={() => setBookingStep(2)} onNext={() => setBookingStep(4)} />
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
                        className={`ly-card-hover w-full rounded-[1.5rem] p-4 border text-left ${
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
                        <PriceLine label="Special Items" value={formatLKR(addOnTotal)} />
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
                          className="ly-action-button bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl py-3 font-black shadow-lg"
                        >
                          <span>Save Booking</span>
                        </button>

                        <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`} target="_blank" rel="noreferrer">
                          <button className="w-full ly-action-button bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 font-black shadow-lg">
                            <span>Chat on WhatsApp</span>
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
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello LaundryYalu, I am interested in the ${plan.name} plan.`)}`}
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
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello LaundryYalu, I need support with my laundry booking.")}`}
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


function QuickTrustStrip() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl bg-white/90 border border-stone-200 p-3 shadow-sm">
        <p className="text-lg">💵</p>
        <p className="text-[11px] font-black text-slate-700 leading-tight mt-1">Pay after confirmation</p>
      </div>
      <div className="rounded-2xl bg-white/90 border border-stone-200 p-3 shadow-sm">
        <p className="text-lg">💬</p>
        <p className="text-[11px] font-black text-slate-700 leading-tight mt-1">WhatsApp support</p>
      </div>
      <div className="rounded-2xl bg-white/90 border border-stone-200 p-3 shadow-sm">
        <p className="text-lg">📍</p>
        <p className="text-[11px] font-black text-slate-700 leading-tight mt-1">Live order status</p>
      </div>
    </div>
  );
}

function ServiceIcon({ id }: { id: string }) {
  const icon = id === "wash-fold" ? "🧺" : id === "iron-only" ? "👔" : "✨";

  return (
    <span className="h-11 w-11 min-w-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-amber-50 border border-stone-200 flex items-center justify-center text-xl shadow-sm">
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


function HowItWorks() {
  const steps = [
    "Book your pickup",
    "We confirm by WhatsApp",
    "Items are counted before processing",
    "Status is updated until delivery",
  ];

  return (
    <div className="ly-lux-panel rounded-[2rem] p-5">
      <h3 className="relative z-10 font-black text-xl text-slate-950">How LaundryYalu Works</h3>

      <div className="relative z-10 grid gap-4 mt-5">
        {steps.map((step, index) => (
          <div
            key={step}
            className="ly-timeline-item flex items-center gap-4"
            style={{ "--loop-delay": `${index * 1.7}s` } as CSSProperties}
          >
            <div className="ly-soft-number h-9 w-9 rounded-full flex items-center justify-center font-black text-sm">
              {index + 1}
            </div>
            <p className="font-bold text-slate-700 leading-snug">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustBadges() {
  const badges = [
    {
      label: "Secure item tracking",
      glow: "radial-gradient(circle at 15% 0%, rgba(20,184,166,0.13), transparent 36%)",
      iconBg: "linear-gradient(135deg, #ecfdf5, #ffffff)",
      iconColor: "#0f766e",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-5" />
        </svg>
      ),
    },
    {
      label: "Transparent pricing",
      glow: "radial-gradient(circle at 18% 0%, rgba(217,119,6,0.15), transparent 38%)",
      iconBg: "linear-gradient(135deg, #fffbeb, #ffffff)",
      iconColor: "#b45309",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M7 7h10" />
          <path d="M7 12h10" />
          <path d="M7 17h6" />
          <path d="M5 3h14a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 011-1z" />
        </svg>
      ),
    },
    {
      label: "WhatsApp confirmation",
      glow: "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.12), transparent 38%)",
      iconBg: "linear-gradient(135deg, #eff6ff, #ffffff)",
      iconColor: "#1d4ed8",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 11.5a8.5 8.5 0 01-12.4 7.6L4 20l.9-4.5A8.5 8.5 0 1121 11.5z" />
          <path d="M8.8 8.8c.4 3.1 2.3 5 5.4 5.4l1.1-1.1 2 .5c.3.1.5.4.5.7v1.4c0 .4-.3.7-.7.7A9.5 9.5 0 017.6 6.9c0-.4.3-.7.7-.7h1.4c.3 0 .6.2.7.5l.5 2-1.1 1.1z" />
        </svg>
      ),
    },
    {
      label: "Live status updates",
      glow: "radial-gradient(circle at 18% 0%, rgba(15,23,42,0.10), transparent 38%)",
      iconBg: "linear-gradient(135deg, #f8fafc, #ffffff)",
      iconColor: "#0f172a",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 12h4l2-5 4 10 2-5h4" />
          <path d="M4 19h16" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {badges.map((badge, index) => (
        <div
          key={badge.label}
          className="ly-lux-badge rounded-[1.5rem] p-4 flex items-center gap-3"
          style={
            {
              animationDelay: `${index * 170}ms`,
              "--lux-glow": badge.glow,
              "--lux-icon-bg": badge.iconBg,
              "--lux-icon-color": badge.iconColor,
              "--shine-delay": `${index * 260}ms`,
            } as CSSProperties
          }
        >
          <span className="ly-lux-icon">{badge.icon}</span>
          <span className="ly-lux-text text-xs font-black text-slate-900 leading-snug">{badge.label}</span>
        </div>
      ))}
    </div>
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
        <div className="h-full bg-gradient-to-r from-emerald-700 to-teal-500 rounded-full transition-all ly-progress" style={{ width: `${(step / 5) * 100}%` }} />
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
        <button onClick={onNext} className="ly-action-button bg-emerald-700 text-white rounded-2xl py-4 font-black text-lg shadow-lg">
          <span>Continue</span>
        </button>
      )}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="ly-card-hover bg-white/90 border border-stone-200 rounded-[2rem] p-4 shadow-sm">
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
          {booking.serviceType || (booking as any).service}
        </span>
        <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-black border border-amber-100">
          {booking.loadPackage}
        </span>
        <span className="text-xs bg-slate-50 text-slate-700 px-3 py-1 rounded-full font-black border border-slate-100">
          {booking.status}
        </span>
      </div>

      <p className="text-xs text-slate-400 mt-2">
        Pickup: {booking.date || (booking as any).pickupDate} • {booking.time || (booking as any).pickupTime}
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
        active ? "bg-gradient-to-r from-emerald-800 to-teal-700 text-white shadow-lg" : "bg-white/80 text-slate-500 border border-stone-200"
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
       inset 0 1px 0 rgba(255,255,255,0.96);
          }
        }

        .ly-lux-panel {
          animation: panelBreath 9s ease-in-out infinite;
        }

        .ly-timeline-item {
          opacity: 0.45;
          animation: timelineLoop 12s ease-in-out infinite;
          animation-delay: var(--loop-delay);
        }

        .ly-soft-number {
          animation: numberLoopGlow 12s ease-in-out infinite;
          animation-delay: var(--loop-delay);
        }

        .ly-card-hover {
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .ly-card-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
        }

        .ly-card-hover:active {
          transform: scale(0.985);
        }
      `}</style>
      <div className="max-w-md mx-auto min-h-screen bg-[#fbfaf7] shadow-[0_30px_90px_rgba(15,23,42,0.22)] overflow-hidden border-x border-white/70">
        <header className="relative overflow-hidden bg-[linear-gradient(135deg,#06281f_0%,#0f766e_50%,#c49a45_135%)] text-white px-5 pt-8 pb-7 rounded-b-[42px] shadow-2xl">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-sm ly-float-glow" />
          <div className="absolute left-5 bottom-0 h-px w-64 bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
          <div className="absolute -left-20 top-24 h-44 w-44 rounded-full bg-emerald-300/15 blur-2xl ly-float-glow" />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] tracking-[0.36em] uppercase text-emerald-100">ඔයාගේ Laundry යාලුවා</p>
                <h1 className="text-5xl font-black mt-2 tracking-tight ly-shimmer">LaundryYalu</h1>
              </div>

              <div className="h-16 w-16 rounded-[1.5rem] bg-white/12 border border-white/20 shadow-xl backdrop-blur flex items-center justify-center text-3xl ly-float-glow">
                ✦
              </div>
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
          {isAdminMode && !adminUser && (
            <div className="space-y-5">
              <SectionTitle title="Admin Login" subtitle="Sign in with the approved admin email to manage LaundryYalu bookings." />

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

                <button onClick={loginAdmin} className="w-full ly-action-button bg-emerald-700 text-white rounded-2xl py-3 font-black">
                  <span>{isAdminLoggingIn ? "Signing in..." : "Sign In to Admin Dashboard"}</span>
                </button>

                <p className="text-xs text-slate-500">
                  Admin updates are protected by Firebase Authentication. Only the approved admin email should be allowed in Firestore rules.
                </p>
              </div>
            </div>
          )}

{isAdminMode && adminUser && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle title="Admin Dashboard" subtitle="Operator view for bookings, updates, billing, and status management." />

                <button onClick={logoutAdmin} className="text-xs bg-stone-100 px-3 py-2 rounded-full font-black">
                  Sign Out
                </button>
              </div>

              <button
                onClick={async () => {
                  await loadAdminBookings();
                  alert("Bookings refreshed.");
                }}
                className="w-full ly-pulse bg-emerald-700 text-white rounded-2xl py-3 font-black"
              >
                Refresh Bookings
              </button>

              <div className="grid grid-cols-2 gap-3">
                <DashboardCard label="Bookings" value={adminBookings.length.toString()} />
                <DashboardCard label="Revenue" value={formatLKR(adminBookings.reduce((sum, b) => sum + (b.finalBill || b.total || 0), 0))} />
              </div>

              <div className="bg-white/90 rounded-[2rem] p-4 border border-stone-200 space-y-3 shadow-sm">
                <Input label="Search Bookings" value={adminSearch} setValue={setAdminSearch} placeholder="Booking ID, phone, name, area" />

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
                  <div className="ly-rise bg-white/90 border border-stone-200 rounded-[2rem] p-5 text-sm text-slate-500">
                    No bookings match your search/filter.
                  </div>
                )}

                {filteredAdminBookings.map((booking) => (
                  <button key={booking.docId || booking.id} onClick={() => openAdminBooking(booking)} className="w-full text-left">
                    <BookingCard booking={booking} />
                  </button>
                ))}
              </div>

              {selectedAdminBooking && (
                <div className="bg-white border-2 border-emerald-500 rounded-3xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 font-black">Manage Booking</p>
                      <h2 className="text-2xl font-black">{selectedAdminBooking.id}</h2>
                    </div>

                    <button onClick={() => setSelectedAdminBooking(null)} className="bg-stone-100 rounded-full px-3 py-2 text-xs font-black">
                      Close
                    </button>
                  </div>

                  <div className="bg-stone-50 rounded-2xl p-4 text-sm space-y-1">
                    <p><strong>Customer:</strong> {selectedAdminBooking.customerName}</p>
                    <p><strong>Phone:</strong> {selectedAdminBooking.phone}</p>
                    <p><strong>Address:</strong> {selectedAdminBooking.address}</p>
                    <p><strong>Pickup:</strong> {selectedAdminBooking.date || (selectedAdminBooking as any).pickupDate} • {selectedAdminBooking.time || (selectedAdminBooking as any).pickupTime}</p>
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

                  <button onClick={saveAdminUpdates} className="w-full ly-pulse bg-emerald-700 text-white rounded-2xl py-3 font-black">
                    Save Updates
                  </button>
                </div>
              )}
            </div>
          )}

          {!isAdminMode && activeTab === "book" && (
            <div className="space-y-5">
              <SectionTitle title="Book a Pickup" subtitle="Start with your service and get a clear estimate before booking." />

              <QuickTrustStrip />
              <StepProgress step={bookingStep} />

              {bookingStep === 1 && (
                <div>
                  <SmallHeading title="1. Select Service" />

                  <div className="grid gap-3 mt-3">
                    {serviceTypes.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedService(item.id)}
                        className={`ly-card-hover text-left rounded-[1.5rem] p-4 border transition ${
                          selectedService === item.id
                            ? "bg-emerald-50 border-emerald-600 shadow-[0_16px_40px_rgba(4,120,87,0.13)]"
                            : "bg-white/90 border-stone-200"
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
                          className={`ly-card-hover w-full text-left rounded-[1.75rem] p-4 border transition shadow-sm ${
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
                    Your selected load already covers normal clothes. Add these only for extra or bulky items like shirts, trousers, sarees, suits, blankets, or curtains.
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
                          <button onClick={() => changeAddOn(item.id, -1)} className="h-8 w-8 rounded-full bg-stone-100 font-black">
                            −
                          </button>
                          <span className="font-black">{selectedAddOns[item.id] || 0}</span>
                          <button onClick={() => changeAddOn(item.id, 1)} className="h-8 w-8 rounded-full bg-emerald-700 text-white font-black">
                            +
                          </button>
                        </div>

                        {(selectedAddOns[item.id] || 0) > 0 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Subtotal: {formatLKR((selectedAddOns[item.id] || 0) * item.price)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <StepButtons onBack={() => setBookingStep(2)} onNext={() => setBookingStep(4)} />
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
                        className={`ly-card-hover w-full rounded-[1.5rem] p-4 border text-left ${
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
                        <PriceLine label="Special Items" value={formatLKR(addOnTotal)} />
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
                          className="ly-action-button bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-2xl py-3 font-black shadow-lg"
                        >
                          <span>Save Booking</span>
                        </button>

                        <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappMessage}`} target="_blank" rel="noreferrer">
                          <button className="w-full ly-action-button bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 font-black shadow-lg">
                            <span>Chat on WhatsApp</span>
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
                      href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello LaundryYalu, I am interested in the ${plan.name} plan.`)}`}
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
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hello LaundryYalu, I need support with my laundry booking.")}`}
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


function QuickTrustStrip() {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl bg-white/90 border border-stone-200 p-3 shadow-sm">
        <p className="text-lg">💵</p>
        <p className="text-[11px] font-black text-slate-700 leading-tight mt-1">Pay after confirmation</p>
      </div>
      <div className="rounded-2xl bg-white/90 border border-stone-200 p-3 shadow-sm">
        <p className="text-lg">💬</p>
        <p className="text-[11px] font-black text-slate-700 leading-tight mt-1">WhatsApp support</p>
      </div>
      <div className="rounded-2xl bg-white/90 border border-stone-200 p-3 shadow-sm">
        <p className="text-lg">📍</p>
        <p className="text-[11px] font-black text-slate-700 leading-tight mt-1">Live order status</p>
      </div>
    </div>
  );
}

function ServiceIcon({ id }: { id: string }) {
  const icon = id === "wash-fold" ? "🧺" : id === "iron-only" ? "👔" : "✨";

  return (
    <span className="h-11 w-11 min-w-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-amber-50 border border-stone-200 flex items-center justify-center text-xl shadow-sm">
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


function HowItWorks() {
  const steps = [
    "Book your pickup",
    "We confirm by WhatsApp",
    "Items are counted before processing",
    "Status is updated until delivery",
  ];

  return (
    <div className="ly-lux-panel rounded-[2rem] p-5">
      <h3 className="relative z-10 font-black text-xl text-slate-950">How LaundryYalu Works</h3>

      <div className="relative z-10 grid gap-4 mt-5">
        {steps.map((step, index) => (
          <div
            key={step}
            className="ly-timeline-item flex items-center gap-4"
            style={{ "--loop-delay": `${index * 1.7}s` } as CSSProperties}
          >
            <div className="ly-soft-number h-9 w-9 rounded-full flex items-center justify-center font-black text-sm">
              {index + 1}
            </div>
            <p className="font-bold text-slate-700 leading-snug">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrustBadges() {
  const badges = [
    {
      label: "Secure item tracking",
      glow: "radial-gradient(circle at 15% 0%, rgba(20,184,166,0.13), transparent 36%)",
      iconBg: "linear-gradient(135deg, #ecfdf5, #ffffff)",
      iconColor: "#0f766e",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
          <path d="M9 12l2 2 4-5" />
        </svg>
      ),
    },
    {
      label: "Transparent pricing",
      glow: "radial-gradient(circle at 18% 0%, rgba(217,119,6,0.15), transparent 38%)",
      iconBg: "linear-gradient(135deg, #fffbeb, #ffffff)",
      iconColor: "#b45309",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M7 7h10" />
          <path d="M7 12h10" />
          <path d="M7 17h6" />
          <path d="M5 3h14a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2V4a1 1 0 011-1z" />
        </svg>
      ),
    },
    {
      label: "WhatsApp confirmation",
      glow: "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.12), transparent 38%)",
      iconBg: "linear-gradient(135deg, #eff6ff, #ffffff)",
      iconColor: "#1d4ed8",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M21 11.5a8.5 8.5 0 01-12.4 7.6L4 20l.9-4.5A8.5 8.5 0 1121 11.5z" />
          <path d="M8.8 8.8c.4 3.1 2.3 5 5.4 5.4l1.1-1.1 2 .5c.3.1.5.4.5.7v1.4c0 .4-.3.7-.7.7A9.5 9.5 0 017.6 6.9c0-.4.3-.7.7-.7h1.4c.3 0 .6.2.7.5l.5 2-1.1 1.1z" />
        </svg>
      ),
    },
    {
      label: "Live status updates",
      glow: "radial-gradient(circle at 18% 0%, rgba(15,23,42,0.10), transparent 38%)",
      iconBg: "linear-gradient(135deg, #f8fafc, #ffffff)",
      iconColor: "#0f172a",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M4 12h4l2-5 4 10 2-5h4" />
          <path d="M4 19h16" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {badges.map((badge, index) => (
        <div
          key={badge.label}
          className="ly-lux-badge rounded-[1.5rem] p-4 flex items-center gap-3"
          style={
            {
              animationDelay: `${index * 170}ms`,
              "--lux-glow": badge.glow,
              "--lux-icon-bg": badge.iconBg,
              "--lux-icon-color": badge.iconColor,
              "--shine-delay": `${index * 260}ms`,
            } as CSSProperties
          }
        >
          <span className="ly-lux-icon">{badge.icon}</span>
          <span className="ly-lux-text text-xs font-black text-slate-900 leading-snug">{badge.label}</span>
        </div>
      ))}
    </div>
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
        <div className="h-full bg-gradient-to-r from-emerald-700 to-teal-500 rounded-full transition-all ly-progress" style={{ width: `${(step / 5) * 100}%` }} />
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
        <button onClick={onNext} className="ly-action-button bg-emerald-700 text-white rounded-2xl py-4 font-black text-lg shadow-lg">
          <span>Continue</span>
        </button>
      )}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <div className="ly-card-hover bg-white/90 border border-stone-200 rounded-[2rem] p-4 shadow-sm">
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
          {booking.serviceType || (booking as any).service}
        </span>
        <span className="text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-black border border-amber-100">
          {booking.loadPackage}
        </span>
        <span className="text-xs bg-slate-50 text-slate-700 px-3 py-1 rounded-full font-black border border-slate-100">
          {booking.status}
        </span>
      </div>

      <p className="text-xs text-slate-400 mt-2">
        Pickup: {booking.date || (booking as any).pickupDate} • {booking.time || (booking as any).pickupTime}
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
        active ? "bg-gradient-to-r from-emerald-800 to-teal-700 text-white shadow-lg" : "bg-white/80 text-slate-500 border border-stone-200"
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
