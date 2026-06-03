using System.Runtime.InteropServices;

namespace Companion.Infrastructure.Telemetry;

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct AcPhysics
{
    public int    PacketId;
    public float  Gas;
    public float  Brake;
    public float  Fuel;
    public int    Gear;
    public int    Rpms;
    public float  SteerAngle;
    public float  SpeedKmh;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
    public float[] Velocity;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
    public float[] AccG;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] WheelSlip;
    public float  WheelLoad;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] WheelsPressure;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] WheelAngularSpeed;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] TyreWear;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] TyreDirtyLevel;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] TyreCoreTemperature;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] CamberRad;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
    public float[] SuspensionTravel;
    public float  Drs;
    public float  TC;
    public float  Heading;
    public float  Pitch;
    public float  Roll;
    public float  CgHeight;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 5)]
    public float[] CarDamage;
    public int    NumberOfTyresOut;
    public int    PitLimiterOn;
    public float  Abs;
    public float  KersCharge;
    public float  KersInput;
    public int    AutoShifterOn;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 2)]
    public float[] RideHeight;
    public float  TurboBoost;
    public float  Ballast;
    public float  AirDensity;
    public float  AirTemp;
    public float  RoadTemp;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
    public float[] LocalAngularVelocity;
    public float  FinalFF;
    public float  PerformanceMeter;
    public int    EngineBrake;
    public int    ErsRecoveryLevel;
    public int    ErsPowerLevel;
    public int    ErsHeatCharging;
    public int    ErsIsCharging;
    public float  KersCurrentKJ;
    public int    DrsAvailable;
    public int    DrsEnabled;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] BrakeTemp;
    public float  Clutch;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] TyreTempI;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] TyreTempM;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] TyreTempO;
    public int    IsAIControlled;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 12)]
    public float[] TyreContactPoint;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 12)]
    public float[] TyreContactNormal;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 12)]
    public float[] TyreContactHeading;
    public float  BrakeBias;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 3)]
    public float[] LocalVelocity;
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct AcGraphics
{
    public int    PacketId;
    public int    Status;           // 0=OFF 1=REPLAY 2=LIVE 3=PAUSE
    public int    Session;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] CurrentTime;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] LastTime;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] BestTime;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] Split;
    public int    CompletedLaps;
    public int    Position;
    public int    ICurrentTime;     // ms da volta atual
    public int    ILastTime;
    public int    IBestTime;
    public float  SessionTimeLeft;
    public float  DistanceTraveled;
    public int    IsInPit;
    public int    CurrentSectorIndex;
    public int    LastSectorTime;
    public int    NumberOfLaps;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] TyreCompound;
    public float  ReplayTimeMultiplier;
    public float  NormalizedCarPosition;  // 0.0-1.0
    public int    ActiveCars;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 180)]  // 60 cars × 3 floats
    public float[] CarCoordinates;
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct AcStatic
{
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] SmVersion;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] AcVersion;
    public int    NumberOfSessions;
    public int    NumberOfCars;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] CarModel;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] Track;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] PlayerName;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] PlayerSurname;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] PlayerNick;
    public int    SectorCount;
    public float  MaxTorque;
    public float  MaxPower;
    public int    MaxRpm;
    public float  MaxFuel;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] SuspensionMaxTravel;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 4)]
    public float[] TyreRadius;
    public float  MaxTurboBoost;
    public float  Deprecated1;
    public float  Deprecated2;
    public int    PenaltiesEnabled;
    public float  AidFuelRate;
    public float  AidTireRate;
    public float  AidMechanicalDamage;
    public int    AidAllowTyreBlankets;
    public float  AidStability;
    public int    AidAutoClutch;
    public int    AidAutoBlip;
    public int    HasDRS;
    public int    HasERS;
    public int    HasKERS;
    public float  KersMaxJ;
    public int    EngineBrakeSettingsCount;
    public int    ErsPowerControllerCount;
    public float  TrackSplineLength;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 15)]
    public char[] TrackConfiguration;
    public float  ErsMaxJ;
    public int    IsTimedRace;
    public int    HasExtraLap;
    [MarshalAs(UnmanagedType.ByValArray, SizeConst = 33)]
    public char[] CarSkin;
    public int    ReversedGridPositions;
    public int    PitWindowStart;
    public int    PitWindowEnd;
}

public static class AcStructHelper
{
    public static (float X, float Y, float Z) GetPlayerPosition(AcGraphics g)
        => (g.CarCoordinates[0], g.CarCoordinates[1], g.CarCoordinates[2]);

    public static string CharsToString(char[] chars)
        => new string(chars).TrimEnd('\0');
}
