import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <>
      <h1 className="text-4xl text-center font-bold">About Us</h1>
    </>
  );
}
