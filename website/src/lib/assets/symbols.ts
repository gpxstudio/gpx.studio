import { Landmark, type Icon, Shell, Bike, Building, Tent, Car, Wrench, ShoppingBasket, Droplet, DoorOpen, Trees, Fuel, Home, Info, TreeDeciduous, CircleParking, Cross, Utensils, Construction, BrickWall, ShowerHead, Mountain, Phone, Eye, TrainFront, Bed } from "lucide-svelte";
import type { ComponentType } from "svelte";

export type Symbol = {
    value: string;
    icon?: ComponentType<Icon>;
};

export const symbols: { [key: string]: Symbol } = {
    bank: { value: 'Bank', icon: Landmark },
    beach: { value: 'Beach', icon: Shell },
    bike_trail: { value: 'Bike Trail', icon: Bike },
    bridge: { value: 'Bridge' },
    building: { value: 'Building', icon: Building },
    campground: { value: 'Campground', icon: Tent },
    car: { value: 'Car', icon: Car },
    car_repair: { value: 'Car Repair', icon: Wrench },
    convenience_store: { value: 'Convenience Store', icon: ShoppingBasket },
    crossing: { value: 'Crossing' },
    department_store: { value: 'Department Store', icon: ShoppingBasket },
    drinking_water: { value: 'Drinking Water', icon: Droplet },
    exit: { value: 'Exit', icon: DoorOpen },
    lodge: { value: 'Lodge', icon: Home },
    forest: { value: 'Forest', icon: Trees },
    gas_station: { value: 'Gas Station', icon: Fuel },
    ground_transportation: { value: 'Ground Transportation', icon: TrainFront },
    hotel: { value: 'Hotel', icon: Bed },
    house: { value: 'House', icon: Home },
    information: { value: 'Information', icon: Info },
    park: { value: 'Park', icon: TreeDeciduous },
    parking_area: { value: 'Parking Area', icon: CircleParking },
    pharmacy: { value: 'Pharmacy', icon: Cross },
    picnic_area: { value: 'Picnic Area', icon: Utensils },
    restaurant: { value: 'Restaurant', icon: Utensils },
    restricted_area: { value: 'Restricted Area', icon: Construction },
    restroom: { value: 'Restroom' },
    road: { value: 'Road', icon: BrickWall },
    scenic_area: { value: 'Scenic Area', icon: Eye },
    shopping_center: { value: 'Shopping Center', icon: ShoppingBasket },
    shower: { value: 'Shower', icon: ShowerHead },
    summit: { value: 'Summit', icon: Mountain },
    telephone: { value: 'Telephone', icon: Phone },
    tunnel: { value: 'Tunnel' },
    water_source: { value: 'Water Source', icon: Droplet },
};