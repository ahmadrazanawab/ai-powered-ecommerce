'use client';
import Image from 'next/image'
import fruit from "../public/image/categories/fruit.jpg"
export default function Home() {
    return (
        <div>
            this is home page
            <Image
                src="/image/categories/fruit.jpg"
                width={500}
                height={500}
                alt="Picture of the author"
            />


        </div>
    );
}
