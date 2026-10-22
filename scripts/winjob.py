"""Own only this launcher's child processes. No PID-based process discovery."""
import os
if os.name=='nt':
 import ctypes
 from ctypes import wintypes as w
 class Limits(ctypes.Structure):
  _fields_=[('process_time',ctypes.c_int64),('job_time',ctypes.c_int64),('flags',w.DWORD),('min_working',ctypes.c_size_t),('max_working',ctypes.c_size_t),('active',w.DWORD),('affinity',ctypes.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
 class IO(ctypes.Structure):
  _fields_=[(name,ctypes.c_uint64) for name in ['read_count','write_count','other_count','read_bytes','write_bytes','other_bytes']]
 class Extended(ctypes.Structure):
  _fields_=[('basic',Limits),('io',IO),('process_memory',ctypes.c_size_t),('job_memory',ctypes.c_size_t),('peak_process',ctypes.c_size_t),('peak_job',ctypes.c_size_t)]
 class Job:
  def __init__(self):
   self.api=ctypes.WinDLL('kernel32',use_last_error=True)
   self.api.CreateJobObjectW.argtypes=[ctypes.c_void_p,w.LPCWSTR];self.api.CreateJobObjectW.restype=w.HANDLE
   self.api.SetInformationJobObject.argtypes=[w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD];self.api.SetInformationJobObject.restype=w.BOOL
   self.api.AssignProcessToJobObject.argtypes=[w.HANDLE,w.HANDLE];self.api.AssignProcessToJobObject.restype=w.BOOL
   self.api.CloseHandle.argtypes=[w.HANDLE];self.api.CloseHandle.restype=w.BOOL
   self.handle=self.api.CreateJobObjectW(None,None)
   if not self.handle:raise ctypes.WinError(ctypes.get_last_error())
   info=Extended();info.basic.flags=0x2000
   if not self.api.SetInformationJobObject(self.handle,9,ctypes.byref(info),ctypes.sizeof(info)):
    self.close();raise ctypes.WinError(ctypes.get_last_error())
  def assign(self,process):
   if not self.api.AssignProcessToJobObject(self.handle,w.HANDLE(int(process._handle))):
    if process.poll() is None:process.kill();raise ctypes.WinError(ctypes.get_last_error())
  def close(self):
   if self.handle:self.api.CloseHandle(self.handle);self.handle=None
else:
 class Job:
  def assign(self,process):pass
  def close(self):pass
