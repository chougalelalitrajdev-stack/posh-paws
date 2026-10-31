import { PetCoat, PetGender, PetOption, PetSize, PetTemperament, PetType, VaccinationStatus } from '../models/pet.model';

export const PET_TYPE_OPTIONS: PetOption<PetType>[] = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
];

export const PET_GENDER_OPTIONS: PetOption<PetGender>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const PET_SIZE_OPTIONS: PetOption<PetSize>[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export const PET_COAT_OPTIONS: PetOption<PetCoat>[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
  { value: 'curly', label: 'Curly' },
  { value: 'double', label: 'Double coat' },
];

export const PET_TEMPERAMENT_OPTIONS: PetOption<PetTemperament>[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'playful', label: 'Playful' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'shy-with-strangers', label: 'Shy with strangers' },
];

export const VACCINATION_OPTIONS: PetOption<VaccinationStatus>[] = [
  { value: 'up-to-date', label: 'Up to date' },
  { value: 'due-soon', label: 'Due soon' },
  { value: 'not-vaccinated', label: 'Not vaccinated' },
  { value: 'unknown', label: 'Not sure' },
];

export const BREEDS: Record<PetType, string[]> = {
  dog: [
    'Mixed breed', 'Indian Pariah', 'Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Pug',
    'Shih Tzu', 'Beagle', 'Poodle', 'Pomeranian', 'Lhasa Apso', 'Cocker Spaniel', 'Dachshund',
    'Siberian Husky', 'Rottweiler', 'Doberman', 'French Bulldog', 'Maltese', 'Spitz', 'Boxer',
  ],
  cat: [
    'Mixed breed', 'Indian Domestic', 'Persian', 'Siamese', 'Maine Coon', 'British Shorthair',
    'Bengal', 'Ragdoll', 'Himalayan', 'Scottish Fold', 'Sphynx', 'Russian Blue',
  ],
};

export const PET_EMOJI: Record<PetType, string> = { dog: '🐶', cat: '🐱' };
