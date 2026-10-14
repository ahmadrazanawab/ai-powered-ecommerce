"use client";
import Image from 'next/image';
import React, { useEffect, useState } from 'react'
import fruits from "./img/fruits .jpg"
import axios from 'axios';

interface categoryI {
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
}
const page = () => {
    const [category, setCategories] = useState<categoryI[]>([]);
    const getAllCategories = async () => {
        try {
            const res = await axios.get("/api/categories");
            console.log(res.data?.data);
            setCategories(res.data?.data);
        } catch (error) {
            console.log("about error..", error);
        }
    }

    useEffect(() => {
        getAllCategories();
    }, []);


    return (
        <div>
            <h4>this is about page</h4>
            <div className="grid grid-cols-2 gap-10">
                {category.map((c) => (
                    <div key={c.categoryId} className="bg-gray-400 shadow-md p-5 rounded-xl">
                        <h4 className="text-2xl">{c.name}</h4>
                        <p className="text-xl">{c.description}</p>
                        <p className="text-xl">{c.slug}</p>
                        <>
                            {c.imageUrl && c.imageUrl ?
                                <Image src={c.imageUrl}
                                    alt="no image"
                                    width={500}
                                    height={500}
                            /> : ""}
                        </>
                    </div>
                ))}
            </div>

        </div>
    )
}

export default page
